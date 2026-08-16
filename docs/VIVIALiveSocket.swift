import Foundation

final class VIVIALiveSocket: ObservableObject {
    static let shared = VIVIALiveSocket()

    // IMPORTANT: replace with your Mac's LAN IP.
    // Example: ws://192.168.0.14:8000/ws/watch
    private let url = URL(string: "ws://192.168.219.117:8000/ws/watch")!

    private var task: URLSessionWebSocketTask?

    private init() {}

    func connect() {
        guard task == nil else { return }
        task = URLSession.shared.webSocketTask(with: url)
        task?.resume()
    }

    func disconnect() {
        task?.cancel(with: .normalClosure, reason: nil)
        task = nil
    }

    func sendHeartRate(_ bpm: Double) {
        guard let task else { return }

        let payload: [String: Any] = [
            "type": "heart_rate",
            "bpm": bpm,
            "timestamp": Date().timeIntervalSince1970
        ]

        guard
            let data = try? JSONSerialization.data(withJSONObject: payload),
            let json = String(data: data, encoding: .utf8)
        else { return }

        task.send(.string(json)) { error in
            if let error {
                print("VIVIA socket send failed:", error)
            }
        }
    }
}
