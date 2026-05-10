import SwiftUI

@main
struct GuardianRoadApp: App {
    var body: some Scene {
        WindowGroup {
            DashcamView()
                .preferredColorScheme(.dark)
        }
    }
}
