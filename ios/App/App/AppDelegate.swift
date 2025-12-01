import UIKit
import Capacitor

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication,
                     didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {

        // Create the main UIWindow
        self.window = UIWindow(frame: UIScreen.main.bounds)

        // Create the Capacitor root WebView controller
        let bridgeVC = CAPBridgeViewController()

        // FIX: Header overlapping the notch -> push content down
        bridgeVC.additionalSafeAreaInsets = UIEdgeInsets(top: 44, left: 0, bottom: 0, right: 0)

        // Assign as root VC
        self.window?.rootViewController = bridgeVC
        self.window?.makeKeyAndVisible()

        return true
    }

    func application(_ application: UIApplication,
                     continue userActivity: NSUserActivity,
                     restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        return ApplicationDelegateProxy.shared.application(application,
                                                           continue: userActivity,
                                                           restorationHandler: restorationHandler)
    }

    func application(_ app: UIApplication, open url: URL,
                     options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        return ApplicationDelegateProxy.shared.application(app,
                                                           open: url,
                                                           options: options)
    }

    func applicationWillResignActive(_ application: UIApplication) {}
    func applicationDidEnterBackground(_ application: UIApplication) {}
    func applicationWillEnterForeground(_ application: UIApplication) {}
    func applicationDidBecomeActive(_ application: UIApplication) {}
    func applicationWillTerminate(_ application: UIApplication) {}
}
