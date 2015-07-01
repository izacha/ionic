import {bootstrap} from 'angular2/angular2';
import {AppViewManager} from 'angular2/src/core/compiler/view_manager';
import {Compiler} from 'angular2/angular2';
import {ElementRef} from 'angular2/src/core/compiler/element_ref';
import {bind} from 'angular2/di';
import {ViewContainerRef} from 'angular2/src/core/compiler/view_container_ref';
import {NgZone} from 'angular2/src/core/zone/ng_zone';

import {IonicRouter} from '../../routing/router';
import {IonicConfig} from '../../config/config';
import {Platform} from '../../platform/platform';
import {Registry} from '../../registry';
import * as util from '../../util/util';


export class IonicApp {

  constructor() {
    this.overlays = [];

    // Our component registry map
    this.components = {};

    this._activeViewId = null;
  }

  load(appRef) {
    this.ref(appRef);
    this.zone(this.injector().get(NgZone));
  }

  ref(val) {
    if (arguments.length) {
      this._ref = val;
    }
    return this._ref;
  }

  injector() {
    return this._ref.injector;
  }

  zone(val) {
    if (arguments.length) {
      this._zone = val;
    }
    return this._zone;
  }

  stateChange(activeView, viewCtrl) {
    if (this._activeViewId !== activeView.id) {
      this.router.stateChange(activeView, viewCtrl);
      this._activeViewId = activeView.id;
    }
  }

  /**
   * Register a known component with a key, for easy lookups later.
   */
  register(key, component) {
    this.components[key] = component;
    console.log('App: Registered component', key, component);
    // TODO(mlynch): We need to track the lifecycle of this component to remove it onDehydrate
  }

  /**
   * Get the component for the given key.
   */
  getComponent(key) {
    return this.components[key];
  }

  /**
   * Create and append the given component into the root
   * element of the app.
   *
   * @param Component the ComponentType to create and insert
   * @return Promise that resolves with the ContainerRef created
   */
  appendComponent(ComponentType: Type) {
    return new Promise((resolve, reject) => {
      let injector = this.injector();
      let compiler = injector.get(Compiler);
      let viewMngr = injector.get(AppViewManager);
      let rootComponentRef = this._ref._hostComponent;
      let viewContainerLocation = rootComponentRef.location;

      compiler.compileInHost(ComponentType).then(protoViewRef => {

        let atIndex = 0;
        let context = null;

        let hostViewRef = viewMngr.createViewInContainer(
                                      viewContainerLocation,
                                      atIndex,
                                      protoViewRef,
                                      context,
                                      injector);

        hostViewRef.elementRef = new ElementRef(hostViewRef, 0, viewMngr._renderer);
        hostViewRef.instance = viewMngr.getComponent(hostViewRef.elementRef);

        hostViewRef.dispose = () => {
          viewMngr.destroyViewInContainer(viewContainerLocation, 0, 0, hostViewRef.viewRef);
        };

        resolve(hostViewRef);

      }).catch(err => {
        console.error('IonicApp appendComponent:', err);
        reject(err);
      });
    });
  }

  applyCss(bodyEle, platform, config) {
    let className = bodyEle.className;

    let versions = platform.versions();
    platform.platforms().forEach(platformName => {
      // platform-ios platform-ios_8 platform-ios_8_3
      let platformClass = ' platform-' + platformName;
      className += platformClass;

      let platformVersion = versions[platformName];
      if (platformVersion) {
        platformClass += '_' + platformVersion.major;
        className += platformClass + platformClass + '_' + platformVersion.minor;
      }
    });

    className += ' mode-' + config.setting('mode');
    bodyEle.className = className.trim();
  }

  isRTL(val) {
    if (arguments.length) {
      this._rtl = val;
    }
    return this._rtl;
  }

}

function initApp(window, document, config) {
  // create the base IonicApp
  let app = new IonicApp();
  app.isRTL(document.documentElement.getAttribute('dir') == 'rtl');

  // load all platform data
  // Platform is a global singleton
  Platform.url(window.location.href);
  Platform.userAgent(window.navigator.userAgent);
  Platform.width(window.innerWidth);
  Platform.height(window.innerHeight);
  Platform.load(config);

  return app;
}

export function ionicBootstrap(ComponentType, config, router) {
  return new Promise((resolve, reject) => {
    try {
      // get the user config, or create one if wasn't passed in
      config = config || new IonicConfig();

      // create the base IonicApp
      let app = initApp(window, document, config);

      // copy default platform settings into the user config platform settings
      // user config platform settings should override default platform settings
      config.setPlatform(Platform);

      // make the config global
      IonicConfig.global = config;

      // config and platform settings have been figured out
      // apply the correct CSS to the app
      app.applyCss(document.body, Platform, config);

      // prepare the ready promise to fire....when ready
      Platform.prepareReady(config);

      // setup router
      router = router || new IonicRouter();
      router.app(app);

      // TODO: don't wire these together
      app.router = router;

      // add injectables that will be available to all child components
      let injectableBindings = [
        bind(IonicApp).toValue(app),
        bind(IonicConfig).toValue(config),
        bind(IonicRouter).toValue(router)
      ];

      bootstrap(ComponentType, injectableBindings).then(appRef => {
        app.load(appRef);

        router.init();

        // resolve that the app has loaded
        resolve(app);

      }).catch(err => {
        console.error('ionicBootstrap', err);
        reject(err);
      });

    } catch (err) {
      console.error('ionicBootstrap', err);
      reject(err);
    }
  });
}

export function load(app) {
  if (!app) {
    console.error('Invalid app module');

  } else if (!app.main) {
    console.error('App module missing main()');

  } else {
    app.main(ionicBootstrap);
  }
}