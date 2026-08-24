import EventKit
import Foundation

let store = EKEventStore()
let semaphore = DispatchSemaphore(value: 0)
var granted = false

if #available(macOS 14.0, *) {
    store.requestFullAccessToEvents { ok, error in
        granted = ok
        if let error = error {
            fputs("error: \(error)\n", stderr)
        }
        semaphore.signal()
    }
} else {
    store.requestAccess(to: .event) { ok, error in
        granted = ok
        if let error = error {
            fputs("error: \(error)\n", stderr)
        }
        semaphore.signal()
    }
}

semaphore.wait()

if !granted {
    print("{\"ok\":false,\"error\":\"Calendar access not granted\"}")
    exit(2)
}

let rows = store.calendars(for: .event).map { calendar -> [String: Any] in
    [
        "name": calendar.title,
        "id": calendar.calendarIdentifier,
        "source": calendar.source.title,
        "source_type": calendar.source.sourceType.rawValue,
        "source_type_name": String(describing: calendar.source.sourceType),
        "writable": calendar.allowsContentModifications,
        "sync_capable": calendar.allowsContentModifications && [2, 3].contains(calendar.source.sourceType.rawValue)
    ]
}

let data = try JSONSerialization.data(withJSONObject: ["ok": true, "calendars": rows], options: [.prettyPrinted, .sortedKeys])
print(String(data: data, encoding: .utf8)!)
