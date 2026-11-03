import React
import React_RCTAppDelegate
import ReactAppDependencyProvider
import UIKit

/// LaunchScreen.storyboard background (#0E1116, the icon artwork's own background).
private let splashBackground = UIColor(red: 0x0E / 255, green: 0x11 / 255, blue: 0x16 / 255, alpha: 1)
/// colors.bg: what a JS reload shows once the launch view is gone.
private let appBackground = UIColor(red: 0x0B / 255, green: 0x0D / 255, blue: 0x10 / 255, alpha: 1)
/// The JS splash turns opaque when its icon loads, or after SPLASH_ICON_TIMEOUT_MS (1 s) at the
/// latest; the launch view is removed well after that.
private let launchViewLifetimeAfterFirstMount: TimeInterval = 3

class SceneDelegate: RCTDefaultReactNativeFactoryDelegate, UIWindowSceneDelegate {
  var window: UIWindow?
  var reactNativeFactory: RCTReactNativeFactory?
  private var firstMountObserver: NSObjectProtocol?

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let windowScene = scene as? UIWindowScene else {
      return
    }

    dependencyProvider = RCTAppDependencyProvider()
    reactNativeFactory = RCTReactNativeFactory(delegate: self)
    window = UIWindow(windowScene: windowScene)
    window?.backgroundColor = splashBackground

    #if DEBUG
    let devMenuConfiguration = RCTDevMenuConfiguration(
      devMenuEnabled: true,
      shakeGestureEnabled: true,
      keyboardShortcutsEnabled: true
    )
    reactNativeFactory?.devMenuConfiguration = devMenuConfiguration
    #endif
    
    reactNativeFactory?.startReactNative(
      withModuleName: "LevelMeasurePro",
      in: window,
      connectionOptions: connectionOptions
    )

   
  }

  /// The launch screen stays under the React surface (instead of systemBackgroundColor), so there is
  /// no white/black frame before the JS splash, and the JS splash can stay see-through until its
  /// own icon has loaded. It is hidden from VoiceOver (the JS splash carries the label) and removed
  /// a few seconds after the first JS mount, by which time the JS splash is opaque, so it can never
  /// show behind a later screen, transition or JS reload.
  override func customize(_ rootView: RCTRootView) {
    super.customize(rootView)
    rootView.backgroundColor = appBackground
    guard let launch = UIStoryboard(name: "LaunchScreen", bundle: nil).instantiateInitialViewController()?.view else {
      return
    }
    launch.frame = rootView.bounds
    launch.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    launch.isUserInteractionEnabled = false
    launch.accessibilityElementsHidden = true
    rootView.insertSubview(launch, at: 0)

    firstMountObserver = NotificationCenter.default.addObserver(
      forName: .RCTContentDidAppear, // RCTContentDidAppearNotification: first JS mount
      object: nil,
      queue: .main
    ) { [weak self, weak launch] _ in
      if let observer = self?.firstMountObserver {
        NotificationCenter.default.removeObserver(observer)
        self?.firstMountObserver = nil
      }
      DispatchQueue.main.asyncAfter(deadline: .now() + launchViewLifetimeAfterFirstMount) {
        launch?.removeFromSuperview()
      }
    }
  }

  func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    RCTLinkingManager.scene(scene, openURLContexts: URLContexts)
  }

  func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
    RCTLinkingManager.scene(scene, continue: userActivity)
  }

  override func bundleURL() -> URL? {
    #if DEBUG
    RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
    #else
    Bundle.main.url(forResource: "main", withExtension: "jsbundle")
    #endif
  }
}
