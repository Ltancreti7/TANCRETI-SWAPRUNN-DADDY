import UIKit
import Capacitor

class SceneDelegate: UIResponder, UIWindowSceneDelegate {

    var window: UIWindow?

    func scene(_ scene: UIScene,
               willConnectTo session: UISceneSession,
               options connectionOptions: UIScene.ConnectionOptions) {

        guard let windowScene = scene as? UIWindowScene else { return }

        let window = UIWindow(windowScene: windowScene)

        let bridgeVC = CAPBridgeViewController()

        // SAFE AREA FIX - push content below the notch
        bridgeVC.additionalSafeAreaInsets = UIEdgeInsets(top: 44, left: 0, bottom: 0, right: 0)

        window.rootViewController = bridgeVC
        window.makeKeyAndVisible()
        self.window = window
    }
}
