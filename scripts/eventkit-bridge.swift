import EventKit
import Foundation

func json(_ value: Any, code: Int32 = 0) -> Never {
    let data = try! JSONSerialization.data(withJSONObject: value, options: [.prettyPrinted, .sortedKeys])
    print(String(data: data, encoding: .utf8)!)
    exit(code)
}

let store = EKEventStore()
let semaphore = DispatchSemaphore(value: 0)
var granted = false

if #available(macOS 14.0, *) {
    store.requestFullAccessToEvents { ok, _ in
        granted = ok
        semaphore.signal()
    }
} else {
    store.requestAccess(to: .event) { ok, _ in
        granted = ok
        semaphore.signal()
    }
}
semaphore.wait()

if !granted {
    json(["ok": false, "error": "Calendar access not granted"], code: 2)
}

func isSyncCapable(_ calendar: EKCalendar) -> Bool {
    calendar.allowsContentModifications && [2, 3].contains(calendar.source.sourceType.rawValue)
}

func calendarRows() -> [[String: Any]] {
    store.calendars(for: .event).map { calendar in
        [
            "name": calendar.title,
            "id": calendar.calendarIdentifier,
            "source": calendar.source.title,
            "source_type": calendar.source.sourceType.rawValue,
            "writable": calendar.allowsContentModifications,
            "sync_capable": isSyncCapable(calendar)
        ]
    }
}

func selectCalendar(named name: String?) -> EKCalendar? {
    let writable = store.calendars(for: .event).filter { $0.allowsContentModifications }
    if let name, !name.isEmpty {
        let named = writable.filter { $0.title == name || $0.calendarIdentifier == name }
        return named.first(where: isSyncCapable) ?? named.first
    }
    return writable.first(where: isSyncCapable)
}

func localDate(_ date: String, _ time: String) -> Date? {
    let formatter = DateFormatter()
    formatter.locale = Locale(identifier: "en_US_POSIX")
    formatter.timeZone = .current
    formatter.dateFormat = "yyyy-MM-dd HH:mm"
    return formatter.date(from: "\(date) \(time)")
}

func eventRow(_ event: EKEvent) -> [String: Any] {
    [
        "title": event.title ?? "",
        "start": ISO8601DateFormatter().string(from: event.startDate),
        "end": ISO8601DateFormatter().string(from: event.endDate),
        "uid": event.eventIdentifier ?? ""
    ]
}

let command = CommandLine.arguments.dropFirst().first ?? "help"

if command == "calendars" {
    json(["ok": true, "calendars": calendarRows()])
}

if command == "events" {
    func valueAfter(_ flag: String) -> String? {
        guard let index = CommandLine.arguments.firstIndex(of: flag), CommandLine.arguments.indices.contains(index + 1) else {
            return nil
        }
        return CommandLine.arguments[index + 1]
    }
    let calendarName = valueAfter("--calendar")
    let date = valueAfter("--date") ?? ""
    guard let calendar = selectCalendar(named: calendarName) else {
        json(["ok": false, "error": "No writable sync-capable calendar found. Enable iCloud Calendar on this Mac first.", "calendars": calendarRows()], code: 3)
    }
    guard let dayStart = localDate(date, "00:00") else {
        json(["ok": false, "error": "Invalid date"], code: 2)
    }
    let dayEnd = Calendar.current.date(byAdding: .day, value: 1, to: dayStart)!
    let predicate = store.predicateForEvents(withStart: dayStart, end: dayEnd, calendars: [calendar])
    let events = store.events(matching: predicate).map(eventRow)
    json(["ok": true, "calendar": calendar.title, "date": date, "events": events])
}

if command == "create" {
    guard let jsonIndex = CommandLine.arguments.firstIndex(of: "--json"), CommandLine.arguments.indices.contains(jsonIndex + 1) else {
        json(["ok": false, "error": "Missing --json"], code: 2)
    }
    guard
        let data = CommandLine.arguments[jsonIndex + 1].data(using: .utf8),
        let payload = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
    else {
        json(["ok": false, "error": "Invalid JSON"], code: 2)
    }
    let requestedCalendar = payload["calendar"] as? String
    guard let calendar = selectCalendar(named: requestedCalendar), isSyncCapable(calendar) else {
        json(["ok": false, "error": "No writable sync-capable calendar found. Enable iCloud Calendar on this Mac first.", "calendars": calendarRows()], code: 3)
    }
    guard
        let title = payload["title"] as? String,
        let date = payload["date"] as? String,
        let time = payload["time"] as? String,
        let start = localDate(date, time)
    else {
        json(["ok": false, "error": "Missing title/date/time"], code: 2)
    }
    let duration = payload["duration"] as? Int ?? 60
    let event = EKEvent(eventStore: store)
    event.calendar = calendar
    event.title = title
    event.notes = payload["notes"] as? String ?? ""
    event.startDate = start
    event.endDate = Calendar.current.date(byAdding: .minute, value: duration, to: start)!
    event.addAlarm(EKAlarm(relativeOffset: 0))
    do {
        try store.save(event, span: .thisEvent, commit: true)
        json(["ok": true, "uid": event.eventIdentifier ?? "", "calendar": calendar.title, "sync_capable": true])
    } catch {
        json(["ok": false, "error": error.localizedDescription], code: 1)
    }
}

json(["ok": false, "commands": ["calendars", "events", "create"]], code: 2)
