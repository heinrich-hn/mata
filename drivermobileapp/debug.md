#### ON LOGIN SCREEN BEFORE LOGIN IN 


ite] connecting...
client:912 [vite] connected.
auth-context.tsx:20 🔐 [AUTH][INFO] Supabase client initialized 
auth-context.tsx:32 🐛 [AUTH][DEBUG] Environment check 
{hasUrl: true, hasKey: true, mode: 'development'}
auth-context.tsx:20 🔐 [AUTH][INFO] Supabase client initialized 
auth-context.tsx:32 🐛 [AUTH][DEBUG] Environment check 
{hasUrl: true, hasKey: true, mode: 'development'}
contentScript.js:24 Content script loaded
auth-context.tsx:20 🔐 [AUTH][INFO] Initial session check 
{hasSession: false, error: undefined, userId: undefined, email: undefined, expiresAt: null}
error-logger.ts:38 🔐 [DIAG][AUTH] INIT_SESSION_CHECK 
{hasSession: false, error: undefined, userId: undefined, email: undefined, expiresAt: null}
auth-context.tsx:32 🐛 [AUTH][DEBUG] Storage diagnostic 
{localStorage: {…}, sdkSessionInLocalStorage: false, backupSessionInLocalStorage: false, indexedDB: {…}, cachedProfile: 'missing'}
auth-context.tsx:32 🐛 [AUTH][DEBUG] Storage keys 
{keys: Array(2)}
auth-context.tsx:20 🔐 [AUTH][INFO] Initial session check 
{hasSession: false, error: undefined, userId: undefined, email: undefined, expiresAt: null}
error-logger.ts:38 🔐 [DIAG][AUTH] INIT_SESSION_CHECK 
{hasSession: false, error: undefined, userId: undefined, email: undefined, expiresAt: null}
auth-context.tsx:20 🔐 [AUTH][INFO] onAuthStateChange: INITIAL_SESSION 
{hasSession: false, userId: undefined, email: undefined, expiresAt: null}
error-logger.ts:38 🔐 [DIAG][AUTH] onAuthStateChange:INITIAL_SESSION 
{hasSession: false, userId: undefined}
installHook.js:1 ⚠️ [AUTH][WARN] INITIAL_SESSION with no session — attempting recovery from backup 
auth-context.tsx:32 🐛 [AUTH][DEBUG] Storage diagnostic 
{localStorage: {…}, sdkSessionInLocalStorage: false, backupSessionInLocalStorage: false, indexedDB: {…}, cachedProfile: 'missing'}
auth-context.tsx:32 🐛 [AUTH][DEBUG] Storage keys 
{keys: Array(2)}
auth-context.tsx:32 🐛 [AUTH][DEBUG] Backup session found? 
{hasBackup: false}
auth-context.tsx:32 🐛 [AUTH][DEBUG] No backup and no session on INITIAL_SESSION — user is logged out 
auth-context.tsx:32 🐛 [AUTH][DEBUG] finishInit called — setting isLoading = false 
error-logger.ts:38 🔐 [DIAG][AUTH] FINISH_INIT 
contentScript.js:355 Background ready: 
{status: 'ok'}




### FIRST WHEN LOGIN IN 

auth-context.tsx:819 Uncaught Error: useAuth must be used within an AuthProvider
    at useAuth (auth-context.tsx:819:11)
    at useDriverRecord (use-driver-record.ts:17:22)
    at HomePage (HomePage.tsx:135:34)
(anonymous)	@	auth-context.tsx:819
(anonymous)	@	use-driver-record.ts:17
(anonymous)	@	HomePage.tsx:135
postMessage		
(anonymous)	@	auth-context.tsx:507
await in signInWithPassword		
(anonymous)	@	auth-context.tsx:729
(anonymous)	@	LoginPage.tsx:45
auth-context.tsx:819 Uncaught Error: useAuth must be used within an AuthProvider
    at useAuth (auth-context.tsx:819:11)
    at useDriverRecord (use-driver-record.ts:17:22)
    at HomePage (HomePage.tsx:135:34)




installHook.js:1 The above error occurred in the <HomePage> component:

    at HomePage (https://legendary-space-bassoon-v6xq44pj6g4wfj5-5175.app.github.dev/src/pages/HomePage.tsx?t=1776243032358:48:29)
    at ProtectedRoute (https://legendary-space-bassoon-v6xq44pj6g4wfj5-5175.app.github.dev/src/App.tsx?t=1776243032358:38:31)
    at RenderedRoute (https://legendary-space-bassoon-v6xq44pj6g4wfj5-5175.app.github.dev/node_modules/.vite/deps/react-router-dom.js?v=cade36af:4131:5)
    at Routes (https://legendary-space-bassoon-v6xq44pj6g4wfj5-5175.app.github.dev/node_modules/.vite/deps/react-router-dom.js?v=cade36af:4601:5)
    at App (https://legendary-space-bassoon-v6xq44pj6g4wfj5-5175.app.github.dev/src/App.tsx?t=1776243032358:162:5)
    at AuthProvider (https://legendary-space-bassoon-v6xq44pj6g4wfj5-5175.app.github.dev/src/contexts/auth-context.tsx?t=1776243032358:128:32)
    at Router (https://legendary-space-bassoon-v6xq44pj6g4wfj5-5175.app.github.dev/node_modules/.vite/deps/react-router-dom.js?v=cade36af:4544:15)
    at BrowserRouter (https://legendary-space-bassoon-v6xq44pj6g4wfj5-5175.app.github.dev/node_modules/.vite/deps/react-router-dom.js?v=cade36af:5290:5)
    at QueryClientProvider (https://legendary-space-bassoon-v6xq44pj6g4wfj5-5175.app.github.dev/node_modules/.vite/deps/@tanstack_react-query.js?v=cade36af:3194:3)
    at ErrorBoundary (https://legendary-space-bassoon-v6xq44pj6g4wfj5-5175.app.github.dev/src/components/ErrorBoundary.tsx:174:9)

React will try to recreate this component tree from scratch using the error boundary you provided, ErrorBoundary.
overrideMethod	@	installHook.js:1
postMessage		
(anonymous)	@	auth-context.tsx:507
await in signInWithPassword		
(anonymous)	@	auth-context.tsx:729
(anonymous)	@	LoginPage.tsx:45
installHook.js:1 App Error: Error: useAuth must be used within an AuthProvider
    at useAuth (auth-context.tsx:819:11)
    at useDriverRecord (use-driver-record.ts:17:22)
    at HomePage (HomePage.tsx:135:34)
 
{componentStack: '\n    at HomePage (https://legendary-space-bassoon-…ithub.dev/src/components/ErrorBoundary.tsx:174:9)'}
 Error Component Stack
    at ErrorBoundary (ErrorBoundary.tsx:19:5)

﻿



### THEN I SAID RETRY - Then it logs in 




10:52:19.632 client:789 [vite] connecting...
10:52:20.112 client:912 [vite] connected.
10:52:22.539 auth-context.tsx:20 🔐 [AUTH][INFO] Supabase client initialized 
10:52:22.539 auth-context.tsx:32 🐛 [AUTH][DEBUG] Environment check {hasUrl: true, hasKey: true, mode: 'development'}
10:52:22.542 auth-context.tsx:20 🔐 [AUTH][INFO] Supabase client initialized 
10:52:22.542 auth-context.tsx:32 🐛 [AUTH][DEBUG] Environment check {hasUrl: true, hasKey: true, mode: 'development'}
10:52:22.617 contentScript.js:24 Content script loaded
10:52:22.661 auth-context.tsx:20 🔐 [AUTH][INFO] onAuthStateChange: SIGNED_IN {hasSession: true, userId: '0dac767c-4452-4987-acef-3c0dfafa22b3', email: 'albert@mat.com', expiresAt: '2026-04-15T09:51:17.000Z'}
10:52:22.661 error-logger.ts:38 🔐 [DIAG][AUTH] onAuthStateChange:SIGNED_IN {hasSession: true, userId: '0dac767c-4452-4987-acef-3c0dfafa22b3'}
10:52:22.666 auth-context.tsx:32 🐛 [AUTH][DEBUG] finishInit called — setting isLoading = false 
10:52:22.666 error-logger.ts:38 🔐 [DIAG][AUTH] FINISH_INIT 
10:52:22.667 auth-context.tsx:20 🔐 [AUTH][INFO] onAuthStateChange: INITIAL_SESSION {hasSession: true, userId: '0dac767c-4452-4987-acef-3c0dfafa22b3', email: 'albert@mat.com', expiresAt: '2026-04-15T09:51:17.000Z'}
10:52:22.667 error-logger.ts:38 🔐 [DIAG][AUTH] onAuthStateChange:INITIAL_SESSION {hasSession: true, userId: '0dac767c-4452-4987-acef-3c0dfafa22b3'}
10:52:22.669 HomePage.tsx:113 🏠 HomePage Debug Info
10:52:22.669 HomePage.tsx:114 User: {id: '0dac767c-4452-4987-acef-3c0dfafa22b3', email: 'albert@mat.com'}
10:52:22.669 HomePage.tsx:115 Profile: null
10:52:22.673 installHook.js:1 🏠 HomePage Debug Info
10:52:22.674 installHook.js:1 User: {id: '0dac767c-4452-4987-acef-3c0dfafa22b3', email: 'albert@mat.com'}
10:52:22.674 installHook.js:1 Profile: null
10:52:22.676 mobile-shell.tsx:25 🐛 [MOBILE_SHELL][DEBUG] Rendering main content {showNav: true, hasUser: true, className: 'none'}
10:52:22.676 mobile-shell.tsx:25 🐛 [MOBILE_SHELL][DEBUG] Rendering main content {showNav: true, hasUser: true, className: 'none'}
10:52:22.683 bottom-nav.tsx:24 🐛 [BOTTOM_NAV][DEBUG] Rendering BottomNav {activePath: '/', renderCount: 1}
10:52:22.684 bottom-nav.tsx:24 🐛 [BOTTOM_NAV][DEBUG] Rendering BottomNav {activePath: '/', renderCount: 1}
10:52:22.697 bottom-nav.tsx:12 🧭 [BOTTOM_NAV][INFO] BottomNav mounted {initialPath: '/', navItemsCount: 4, navItems: Array(4)}
10:52:22.697 mobile-shell.tsx:13 📱 [MOBILE_SHELL][INFO] MobileShell mounted {showNav: true, hasChildren: true, renderCount: 1}
10:52:22.697 mobile-shell.tsx:25 🐛 [MOBILE_SHELL][DEBUG] Auth state in MobileShell {isLoading: false, hasError: false, errorMessage: undefined, hasUser: true, userEmail: 'albert@mat.com', …}
10:52:22.697 mobile-shell.tsx:25 🐛 [MOBILE_SHELL][DEBUG] Loading state changed {isLoading: false, isAuthenticated: true}
10:52:22.698 use-driver-record.ts:24 🔍 useDriverRecord: Looking up driver for {authId: '0dac767c-4452-4987-acef-3c0dfafa22b3', email: 'albert@mat.com'}
10:52:22.699 use-realtime.ts:12 🔌 [REALTIME][INFO] Setting up vehicle assignment subscription {userId: '0dac767c-4452-4987-acef-3c0dfafa22b3'}
10:52:22.702 use-realtime.ts:24 🐛 [REALTIME][DEBUG] Skipping diesel realtime sync {hasDriverId: true, hasFleetNumber: false}
10:52:22.702 use-realtime.ts:24 🐛 [REALTIME][DEBUG] Skipping trips realtime sync - no vehicle ID 
10:52:22.703 bottom-nav.tsx:12 🧭 [BOTTOM_NAV][INFO] BottomNav unmounting 
10:52:22.703 mobile-shell.tsx:13 📱 [MOBILE_SHELL][INFO] MobileShell unmounting 
10:52:22.704 use-realtime.ts:12 🔌 [REALTIME][INFO] Cleaning up vehicle assignment subscription 
10:52:22.704 use-realtime.ts:24 🐛 [REALTIME][DEBUG] Vehicle assignment subscription status {status: 'CLOSED'}
10:52:22.705 bottom-nav.tsx:12 🧭 [BOTTOM_NAV][INFO] BottomNav mounted {initialPath: '/', navItemsCount: 4, navItems: Array(4)}
10:52:22.705 mobile-shell.tsx:13 📱 [MOBILE_SHELL][INFO] MobileShell mounted {showNav: true, hasChildren: true, renderCount: 1}
10:52:22.705 mobile-shell.tsx:25 🐛 [MOBILE_SHELL][DEBUG] Auth state in MobileShell {isLoading: false, hasError: false, errorMessage: undefined, hasUser: true, userEmail: 'albert@mat.com', …}
10:52:22.705 mobile-shell.tsx:25 🐛 [MOBILE_SHELL][DEBUG] Loading state changed {isLoading: false, isAuthenticated: true}
10:52:22.706 use-realtime.ts:12 🔌 [REALTIME][INFO] Setting up vehicle assignment subscription {userId: '0dac767c-4452-4987-acef-3c0dfafa22b3'}
10:52:22.706 use-realtime.ts:24 🐛 [REALTIME][DEBUG] Skipping diesel realtime sync {hasDriverId: true, hasFleetNumber: false}
10:52:22.706 use-realtime.ts:24 🐛 [REALTIME][DEBUG] Skipping trips realtime sync - no vehicle ID 
10:52:22.709 auth-context.tsx:20 🔐 [AUTH][INFO] SIGNED_IN — invalidating queries (deferred) 
10:52:22.709 error-logger.ts:38 🔐 [DIAG][AUTH] INVALIDATE_QUERIES:SIGNED_IN 
10:52:22.711 auth-context.tsx:32 🐛 [AUTH][DEBUG] fetchProfile called {userEmail: 'albert@mat.com', version: 2}
10:52:22.717 auth-context.tsx:32 🐛 [AUTH][DEBUG] fetchProfile called {userEmail: 'albert@mat.com', version: 3}
10:52:22.719 contentScript.js:355 Background ready: {status: 'ok'}
10:52:23.578 use-realtime.ts:24 🐛 [REALTIME][DEBUG] Vehicle assignment subscription status {status: 'SUBSCRIBED'}
10:52:23.775 HomePage.tsx:196 📊 HomePage: Assignments found: 1 for driver_id: 0dac767c-4452-4987-acef-3c0dfafa22b3
10:52:23.778 mobile-shell.tsx:25 🐛 [MOBILE_SHELL][DEBUG] Rendering main content {showNav: true, hasUser: true, className: 'none'}
10:52:23.778 mobile-shell.tsx:25 🐛 [MOBILE_SHELL][DEBUG] Rendering main content {showNav: true, hasUser: true, className: 'none'}
10:52:23.781 bottom-nav.tsx:24 🐛 [BOTTOM_NAV][DEBUG] Rendering BottomNav {activePath: '/', renderCount: 2}
10:52:23.782 bottom-nav.tsx:24 🐛 [BOTTOM_NAV][DEBUG] Rendering BottomNav {activePath: '/', renderCount: 3}
10:52:23.787 mobile-shell.tsx:13 📱 [MOBILE_SHELL][INFO] MobileShell unmounting 
10:52:23.788 mobile-shell.tsx:13 📱 [MOBILE_SHELL][INFO] MobileShell mounted {showNav: true, hasChildren: true, renderCount: 3}
10:52:23.788 use-realtime.ts:12 🔌 [REALTIME][INFO] Setting up diesel realtime sync {driverId: '0dac767c-4452-4987-acef-3c0dfafa22b3', fleetNumber: '23H'}
10:52:23.789 use-realtime.ts:12 🔌 [REALTIME][INFO] Setting up trips realtime sync {vehicleId: '5e5d75b9-925e-4000-889f-98be8eb2fbc7'}
10:52:23.799 auth-context.tsx:20 🔐 [AUTH][INFO] Profile fetched successfully {user_id: 40, username: 'albert.zunga', role: 'Driver'}
10:52:23.802 mobile-shell.tsx:25 🐛 [MOBILE_SHELL][DEBUG] Rendering main content {showNav: true, hasUser: true, className: 'none'}
10:52:23.802 mobile-shell.tsx:25 🐛 [MOBILE_SHELL][DEBUG] Rendering main content {showNav: true, hasUser: true, className: 'none'}
10:52:23.803 bottom-nav.tsx:24 🐛 [BOTTOM_NAV][DEBUG] Rendering BottomNav {activePath: '/', renderCount: 4}
10:52:23.804 bottom-nav.tsx:24 🐛 [BOTTOM_NAV][DEBUG] Rendering BottomNav {activePath: '/', renderCount: 5}
10:52:23.808 use-driver-record.ts:39 ✅ useDriverRecord: Found driver by auth_user_id: 33a96d03-8d26-4ece-ab91-4e011d7a350a
10:52:23.809 mobile-shell.tsx:13 📱 [MOBILE_SHELL][INFO] MobileShell unmounting 
10:52:23.809 mobile-shell.tsx:13 📱 [MOBILE_SHELL][INFO] MobileShell mounted {showNav: true, hasChildren: true, renderCount: 5}
10:52:23.810 mobile-shell.tsx:25 🐛 [MOBILE_SHELL][DEBUG] Rendering main content {showNav: true, hasUser: true, className: 'none'}
10:52:23.810 mobile-shell.tsx:25 🐛 [MOBILE_SHELL][DEBUG] Rendering main content {showNav: true, hasUser: true, className: 'none'}
10:52:23.812 bottom-nav.tsx:24 🐛 [BOTTOM_NAV][DEBUG] Rendering BottomNav {activePath: '/', renderCount: 6}
10:52:23.813 bottom-nav.tsx:24 🐛 [BOTTOM_NAV][DEBUG] Rendering BottomNav {activePath: '/', renderCount: 7}
10:52:23.814 mobile-shell.tsx:13 📱 [MOBILE_SHELL][INFO] MobileShell unmounting 
10:52:23.814 mobile-shell.tsx:13 📱 [MOBILE_SHELL][INFO] MobileShell mounted {showNav: true, hasChildren: true, renderCount: 7}
10:52:23.988 use-realtime.ts:24 🐛 [REALTIME][DEBUG] Diesel realtime subscription status {status: 'SUBSCRIBED'}
10:52:23.989 use-realtime.ts:24 🐛 [REALTIME][DEBUG] Trips realtime subscription status {status: 'SUBSCRIBED'}
10:52:24.195 mobile-shell.tsx:25 🐛 [MOBILE_SHELL][DEBUG] Rendering main content {showNav: true, hasUser: true, className: 'none'}
10:52:24.195 mobile-shell.tsx:25 🐛 [MOBILE_SHELL][DEBUG] Rendering main content {showNav: true, hasUser: true, className: 'none'}
10:52:24.201 bottom-nav.tsx:24 🐛 [BOTTOM_NAV][DEBUG] Rendering BottomNav {activePath: '/', renderCount: 8}
10:52:24.202 bottom-nav.tsx:24 🐛 [BOTTOM_NAV][DEBUG] Rendering BottomNav {activePath: '/', renderCount: 9}
10:52:24.205 mobile-shell.tsx:13 📱 [MOBILE_SHELL][INFO] MobileShell unmounting 
10:52:24.205 mobile-shell.tsx:13 📱 [MOBILE_SHELL][INFO] MobileShell mounted {showNav: true, hasChildren: true, renderCount: 9}
10:52:24.208 mobile-shell.tsx:25 🐛 [MOBILE_SHELL][DEBUG] Rendering main content {showNav: true, hasUser: true, className: 'none'}
10:52:24.209 mobile-shell.tsx:25 🐛 [MOBILE_SHELL][DEBUG] Rendering main content {showNav: true, hasUser: true, className: 'none'}
10:52:24.210 bottom-nav.tsx:24 🐛 [BOTTOM_NAV][DEBUG] Rendering BottomNav {activePath: '/', renderCount: 10}
10:52:24.211 bottom-nav.tsx:24 🐛 [BOTTOM_NAV][DEBUG] Rendering BottomNav {activePath: '/', renderCount: 11}
10:52:24.213 mobile-shell.tsx:13 📱 [MOBILE_SHELL][INFO] MobileShell unmounting 
10:52:24.213 mobile-shell.tsx:13 📱 [MOBILE_SHELL][INFO] MobileShell mounted {showNav: true, hasChildren: true, renderCount: 11}
10:52:24.216 mobile-shell.tsx:25 🐛 [MOBILE_SHELL][DEBUG] Rendering main content {showNav: true, hasUser: true, className: 'none'}
10:52:24.217 mobile-shell.tsx:25 🐛 [MOBILE_SHELL][DEBUG] Rendering main content {showNav: true, hasUser: true, className: 'none'}
10:52:24.219 bottom-nav.tsx:24 🐛 [BOTTOM_NAV][DEBUG] Rendering BottomNav {activePath: '/', renderCount: 12}
10:52:24.220 bottom-nav.tsx:24 🐛 [BOTTOM_NAV][DEBUG] Rendering BottomNav {activePath: '/', renderCount: 13}
10:52:24.223 mobile-shell.tsx:13 📱 [MOBILE_SHELL][INFO] MobileShell unmounting 
10:52:24.224 mobile-shell.tsx:13 📱 [MOBILE_SHELL][INFO] MobileShell mounted {showNav: true, hasChildren: true, renderCount: 13}
10:52:24.545 auth-context.tsx:32 🐛 [AUTH][DEBUG] App foregrounded — checking session 
10:52:24.545 error-logger.ts:38 🔐 [DIAG][AUTH] VISIBILITY_FOREGROUND 
10:52:24.546 auth-context.tsx:20 🔐 [AUTH][INFO] onAuthStateChange: SIGNED_IN {hasSession: true, userId: '0dac767c-4452-4987-acef-3c0dfafa22b3', email: 'albert@mat.com', expiresAt: '2026-04-15T09:51:17.000Z'}
10:52:24.546 error-logger.ts:38 🔐 [DIAG][AUTH] onAuthStateChange:SIGNED_IN {hasSession: true, userId: '0dac767c-4452-4987-acef-3c0dfafa22b3'}
10:52:24.551 mobile-shell.tsx:25 🐛 [MOBILE_SHELL][DEBUG] Rendering main content {showNav: true, hasUser: true, className: 'none'}
10:52:24.551 mobile-shell.tsx:25 🐛 [MOBILE_SHELL][DEBUG] Rendering main content {showNav: true, hasUser: true, className: 'none'}
10:52:24.554 bottom-nav.tsx:24 🐛 [BOTTOM_NAV][DEBUG] Rendering BottomNav {activePath: '/', renderCount: 14}
10:52:24.554 bottom-nav.tsx:24 🐛 [BOTTOM_NAV][DEBUG] Rendering BottomNav {activePath: '/', renderCount: 15}
10:52:24.561 auth-context.tsx:20 🔐 [AUTH][INFO] Initial session check {hasSession: true, error: undefined, userId: '0dac767c-4452-4987-acef-3c0dfafa22b3', email: 'albert@mat.com', expiresAt: '2026-04-15T09:51:17.000Z'}
10:52:24.561 error-logger.ts:38 🔐 [DIAG][AUTH] INIT_SESSION_CHECK {hasSession: true, error: undefined, userId: '0dac767c-4452-4987-acef-3c0dfafa22b3', email: 'albert@mat.com', expiresAt: '2026-04-15T09:51:17.000Z'}
10:52:24.563 auth-context.tsx:20 🔐 [AUTH][INFO] Initial session check {hasSession: true, error: undefined, userId: '0dac767c-4452-4987-acef-3c0dfafa22b3', email: 'albert@mat.com', expiresAt: '2026-04-15T09:51:17.000Z'}
10:52:24.563 error-logger.ts:38 🔐 [DIAG][AUTH] INIT_SESSION_CHECK {hasSession: true, error: undefined, userId: '0dac767c-4452-4987-acef-3c0dfafa22b3', email: 'albert@mat.com', expiresAt: '2026-04-15T09:51:17.000Z'}
10:52:24.577 mobile-shell.tsx:13 📱 [MOBILE_SHELL][INFO] MobileShell unmounting 
10:52:24.577 mobile-shell.tsx:13 📱 [MOBILE_SHELL][INFO] MobileShell mounted {showNav: true, hasChildren: true, renderCount: 15}
10:52:24.578 mobile-shell.tsx:25 🐛 [MOBILE_SHELL][DEBUG] Auth state in MobileShell {isLoading: false, hasError: false, errorMessage: undefined, hasUser: true, userEmail: 'albert@mat.com', …}
10:52:24.578 mobile-shell.tsx:25 🐛 [MOBILE_SHELL][DEBUG] Loading state changed {isLoading: false, isAuthenticated: true}
10:52:24.579 auth-context.tsx:20 🔐 [AUTH][INFO] SIGNED_IN — invalidating queries (deferred) 
10:52:24.579 error-logger.ts:38 🔐 [DIAG][AUTH] INVALIDATE_QUERIES:SIGNED_IN 
10:52:24.579 use-driver-record.ts:24 🔍 useDriverRecord: Looking up driver for {authId: '0dac767c-4452-4987-acef-3c0dfafa22b3', email: 'albert@mat.com'}
10:52:24.580 auth-context.tsx:32 🐛 [AUTH][DEBUG] fetchProfile called {userEmail: 'albert@mat.com', version: 4}
10:52:24.591 auth-context.tsx:32 🐛 [AUTH][DEBUG] Storage diagnostic {localStorage: {…}, sdkSessionInLocalStorage: true, sdkSessionExpired: false, sdkSessionUserId: '0dac767c-4452-4987-acef-3c0dfafa22b3', backupSessionInLocalStorage: true, …}
10:52:24.592 auth-context.tsx:32 🐛 [AUTH][DEBUG] Storage keys {keys: Array(5)}
10:52:24.592 auth-context.tsx:32 🐛 [AUTH][DEBUG] Storage diagnostic {localStorage: {…}, sdkSessionInLocalStorage: true, sdkSessionExpired: false, sdkSessionUserId: '0dac767c-4452-4987-acef-3c0dfafa22b3', backupSessionInLocalStorage: true, …}
10:52:24.592 auth-context.tsx:32 🐛 [AUTH][DEBUG] Storage keys {keys: Array(5)}
10:52:24.838 mobile-shell.tsx:25 🐛 [MOBILE_SHELL][DEBUG] Rendering main content {showNav: true, hasUser: true, className: 'none'}
10:52:24.839 mobile-shell.tsx:25 🐛 [MOBILE_SHELL][DEBUG] Rendering main content {showNav: true, hasUser: true, className: 'none'}
10:52:24.842 bottom-nav.tsx:24 🐛 [BOTTOM_NAV][DEBUG] Rendering BottomNav {activePath: '/', renderCount: 16}
10:52:24.842 bottom-nav.tsx:24 🐛 [BOTTOM_NAV][DEBUG] Rendering BottomNav {activePath: '/', renderCount: 17}
10:52:24.847 mobile-shell.tsx:13 📱 [MOBILE_SHELL][INFO] MobileShell unmounting 
10:52:24.847 mobile-shell.tsx:13 📱 [MOBILE_SHELL][INFO] MobileShell mounted {showNav: true, hasChildren: true, renderCount: 17}
10:52:24.848 auth-context.tsx:32 🐛 [AUTH][DEBUG] Foreground session check {hasSession: true}
10:52:24.988 HomePage.tsx:196 📊 HomePage: Assignments found: 1 for driver_id: 0dac767c-4452-4987-acef-3c0dfafa22b3
10:52:24.988 use-driver-record.ts:39 ✅ useDriverRecord: Found driver by auth_user_id: 33a96d03-8d26-4ece-ab91-4e011d7a350a
10:52:25.281 auth-context.tsx:20 🔐 [AUTH][INFO] onAuthStateChange: TOKEN_REFRESHED {hasSession: true, userId: '0dac767c-4452-4987-acef-3c0dfafa22b3', email: 'albert@mat.com', expiresAt: '2026-04-15T09:52:24.000Z'}
10:52:25.281 error-logger.ts:38 🔐 [DIAG][AUTH] onAuthStateChange:TOKEN_REFRESHED {hasSession: true, userId: '0dac767c-4452-4987-acef-3c0dfafa22b3'}
10:52:25.283 mobile-shell.tsx:25 🐛 [MOBILE_SHELL][DEBUG] Rendering main content {showNav: true, hasUser: true, className: 'none'}
10:52:25.283 mobile-shell.tsx:25 🐛 [MOBILE_SHELL][DEBUG] Rendering main content {showNav: true, hasUser: true, className: 'none'}
10:52:25.285 bottom-nav.tsx:24 🐛 [BOTTOM_NAV][DEBUG] Rendering BottomNav {activePath: '/', renderCount: 18}
10:52:25.285 bottom-nav.tsx:24 🐛 [BOTTOM_NAV][DEBUG] Rendering BottomNav {activePath: '/', renderCount: 19}
10:52:25.286 mobile-shell.tsx:13 📱 [MOBILE_SHELL][INFO] MobileShell unmounting 
10:52:25.287 mobile-shell.tsx:13 📱 [MOBILE_SHELL][INFO] MobileShell mounted {showNav: true, hasChildren: true, renderCount: 19}
10:52:25.287 mobile-shell.tsx:25 🐛 [MOBILE_SHELL][DEBUG] Auth state in MobileShell {isLoading: false, hasError: false, errorMessage: undefined, hasUser: true, userEmail: 'albert@mat.com', …}
10:52:25.287 mobile-shell.tsx:25 🐛 [MOBILE_SHELL][DEBUG] Loading state changed {isLoading: false, isAuthenticated: true}
10:52:25.289 auth-context.tsx:20 🔐 [AUTH][INFO] Proactive session refresh succeeded 
10:52:25.289 auth-context.tsx:20 🔐 [AUTH][INFO] TOKEN_REFRESHED — invalidating queries (deferred) 
10:52:25.290 error-logger.ts:38 🔐 [DIAG][AUTH] INVALIDATE_QUERIES:TOKEN_REFRESHED 
10:52:25.290 use-driver-record.ts:24 🔍 useDriverRecord: Looking up driver for {authId: '0dac767c-4452-4987-acef-3c0dfafa22b3', email: 'albert@mat.com'}
10:52:25.292 auth-context.tsx:32 🐛 [AUTH][DEBUG] fetchProfile called {userEmail: 'albert@mat.com', version: 5}
10:52:25.299 auth-context.tsx:32 🐛 [AUTH][DEBUG] fetchProfile called {userEmail: 'albert@mat.com', version: 6}
10:52:25.621 mobile-shell.tsx:25 🐛 [MOBILE_SHELL][DEBUG] Rendering main content {showNav: true, hasUser: true, className: 'none'}
10:52:25.621 mobile-shell.tsx:25 🐛 [MOBILE_SHELL][DEBUG] Rendering main content {showNav: true, hasUser: true, className: 'none'}
10:52:25.623 bottom-nav.tsx:24 🐛 [BOTTOM_NAV][DEBUG] Rendering BottomNav {activePath: '/', renderCount: 20}
10:52:25.624 bottom-nav.tsx:24 🐛 [BOTTOM_NAV][DEBUG] Rendering BottomNav {activePath: '/', renderCount: 21}
10:52:25.625 mobile-shell.tsx:13 📱 [MOBILE_SHELL][INFO] MobileShell unmounting 
10:52:25.626 mobile-shell.tsx:13 📱 [MOBILE_SHELL][INFO] MobileShell mounted {showNav: true, hasChildren: true, renderCount: 21}
10:52:25.696 HomePage.tsx:196 📊 HomePage: Assignments found: 1 for driver_id: 0dac767c-4452-4987-acef-3c0dfafa22b3
10:52:25.710 auth-context.tsx:20 🔐 [AUTH][INFO] Profile fetched successfully {user_id: 40, username: 'albert.zunga', role: 'Driver'}
10:52:25.710 use-driver-record.ts:24 🔍 useDriverRecord: Looking up driver for {authId: '0dac767c-4452-4987-acef-3c0dfafa22b3', email: 'albert@mat.com'}
10:52:25.717 mobile-shell.tsx:25 🐛 [MOBILE_SHELL][DEBUG] Rendering main content {showNav: true, hasUser: true, className: 'none'}
10:52:25.717 mobile-shell.tsx:25 🐛 [MOBILE_SHELL][DEBUG] Rendering main content {showNav: true, hasUser: true, className: 'none'}
10:52:25.720 bottom-nav.tsx:24 🐛 [BOTTOM_NAV][DEBUG] Rendering BottomNav {activePath: '/', renderCount: 22}
10:52:25.720 bottom-nav.tsx:24 🐛 [BOTTOM_NAV][DEBUG] Rendering BottomNav {activePath: '/', renderCount: 23}
10:52:25.721 mobile-shell.tsx:13 📱 [MOBILE_SHELL][INFO] MobileShell unmounting 
10:52:25.722 mobile-shell.tsx:13 📱 [MOBILE_SHELL][INFO] MobileShell mounted {showNav: true, hasChildren: true, renderCount: 23}
10:52:26.097 use-driver-record.ts:39 ✅ useDriverRecord: Found driver by auth_user_id: 33a96d03-8d26-4ece-ab91-4e011d7a350a
10:52:26.101 HomePage.tsx:196 📊 HomePage: Assignments found: 1 for driver_id: 0dac767c-4452-4987-acef-3c0dfafa22b3
10:52:26.328 use-driver-record.ts:39 ✅ useDriverRecord: Found driver by auth_user_id: 33a96d03-8d26-4ece-ab91-4e011d7a350a
10:52:55.411 auth-context.tsx:32 🐛 [AUTH][DEBUG] App foregrounded — checking session 
10:52:55.411 error-logger.ts:38 🔐 [DIAG][AUTH] VISIBILITY_FOREGROUND 
10:52:55.413 auth-context.tsx:20 🔐 [AUTH][INFO] onAuthStateChange: SIGNED_IN {hasSession: true, userId: '0dac767c-4452-4987-acef-3c0dfafa22b3', email: 'albert@mat.com', expiresAt: '2026-04-15T09:52:24.000Z'}
10:52:55.413 error-logger.ts:38 🔐 [DIAG][AUTH] onAuthStateChange:SIGNED_IN {hasSession: true, userId: '0dac767c-4452-4987-acef-3c0dfafa22b3'}
10:52:55.419 mobile-shell.tsx:25 🐛 [MOBILE_SHELL][DEBUG] Rendering main content {showNav: true, hasUser: true, className: 'none'}
10:52:55.422 mobile-shell.tsx:25 🐛 [MOBILE_SHELL][DEBUG] Rendering main content {showNav: true, hasUser: true, className: 'none'}
10:52:55.428 bottom-nav.tsx:24 🐛 [BOTTOM_NAV][DEBUG] Rendering BottomNav {activePath: '/', renderCount: 24}
10:52:55.429 bottom-nav.tsx:24 🐛 [BOTTOM_NAV][DEBUG] Rendering BottomNav {activePath: '/', renderCount: 25}
10:52:55.431 mobile-shell.tsx:13 📱 [MOBILE_SHELL][INFO] MobileShell unmounting 
10:52:55.432 mobile-shell.tsx:13 📱 [MOBILE_SHELL][INFO] MobileShell mounted {showNav: true, hasChildren: true, renderCount: 25}
10:52:55.432 mobile-shell.tsx:25 🐛 [MOBILE_SHELL][DEBUG] Auth state in MobileShell {isLoading: false, hasError: false, errorMessage: undefined, hasUser: true, userEmail: 'albert@mat.com', …}
10:52:55.432 mobile-shell.tsx:25 🐛 [MOBILE_SHELL][DEBUG] Loading state changed {isLoading: false, isAuthenticated: true}
10:52:55.437 auth-context.tsx:20 🔐 [AUTH][INFO] SIGNED_IN — invalidating queries (deferred) 
10:52:55.437 error-logger.ts:38 🔐 [DIAG][AUTH] INVALIDATE_QUERIES:SIGNED_IN 
10:52:55.438 use-driver-record.ts:24 🔍 useDriverRecord: Looking up driver for {authId: '0dac767c-4452-4987-acef-3c0dfafa22b3', email: 'albert@mat.com'}
10:52:55.439 auth-context.tsx:32 🐛 [AUTH][DEBUG] fetchProfile called {userEmail: 'albert@mat.com', version: 7}
10:52:55.720 auth-context.tsx:32 🐛 [AUTH][DEBUG] Foreground session check {hasSession: true}
10:52:56.027 use-driver-record.ts:39 ✅ useDriverRecord: Found driver by auth_user_id: 33a96d03-8d26-4ece-ab91-4e011d7a350a
10:52:56.048 HomePage.tsx:196 📊 HomePage: Assignments found: 1 for driver_id: 0dac767c-4452-4987-acef-3c0dfafa22b3
10:52:56.049 auth-context.tsx:20 🔐 [AUTH][INFO] Profile fetched successfully {user_id: 40, username: 'albert.zunga', role: 'Driver'}
10:52:56.050 mobile-shell.tsx:25 🐛 [MOBILE_SHELL][DEBUG] Rendering main content {showNav: true, hasUser: true, className: 'none'}
10:52:56.051 mobile-shell.tsx:25 🐛 [MOBILE_SHELL][DEBUG] Rendering main content {showNav: true, hasUser: true, className: 'none'}
10:52:56.052 bottom-nav.tsx:24 🐛 [BOTTOM_NAV][DEBUG] Rendering BottomNav {activePath: '/', renderCount: 26}
10:52:56.052 bottom-nav.tsx:24 🐛 [BOTTOM_NAV][DEBUG] Rendering BottomNav {activePath: '/', renderCount: 27}
10:52:56.053 mobile-shell.tsx:13 📱 [MOBILE_SHELL][INFO] MobileShell unmounting 
10:52:56.053 mobile-shell.tsx:13 📱 [MOBILE_SHELL][INFO] MobileShell mounted {showNav: true, hasChildren: true, renderCount: 27}
10:52:56.114 auth-context.tsx:20 🔐 [AUTH][INFO] onAuthStateChange: TOKEN_REFRESHED {hasSession: true, userId: '0dac767c-4452-4987-acef-3c0dfafa22b3', email: 'albert@mat.com', expiresAt: '2026-04-15T09:52:55.000Z'}
10:52:56.114 error-logger.ts:38 🔐 [DIAG][AUTH] onAuthStateChange:TOKEN_REFRESHED {hasSession: true, userId: '0dac767c-4452-4987-acef-3c0dfafa22b3'}
10:52:56.116 mobile-shell.tsx:25 🐛 [MOBILE_SHELL][DEBUG] Rendering main content {showNav: true, hasUser: true, className: 'none'}
10:52:56.116 mobile-shell.tsx:25 🐛 [MOBILE_SHELL][DEBUG] Rendering main content {showNav: true, hasUser: true, className: 'none'}
10:52:56.117 bottom-nav.tsx:24 🐛 [BOTTOM_NAV][DEBUG] Rendering BottomNav {activePath: '/', renderCount: 28}
10:52:56.117 bottom-nav.tsx:24 🐛 [BOTTOM_NAV][DEBUG] Rendering BottomNav {activePath: '/', renderCount: 29}
10:52:56.118 mobile-shell.tsx:13 📱 [MOBILE_SHELL][INFO] MobileShell unmounting 
10:52:56.118 mobile-shell.tsx:13 📱 [MOBILE_SHELL][INFO] MobileShell mounted {showNav: true, hasChildren: true, renderCount: 29}
10:52:56.118 mobile-shell.tsx:25 🐛 [MOBILE_SHELL][DEBUG] Auth state in MobileShell {isLoading: false, hasError: false, errorMessage: undefined, hasUser: true, userEmail: 'albert@mat.com', …}
10:52:56.118 mobile-shell.tsx:25 🐛 [MOBILE_SHELL][DEBUG] Loading state changed {isLoading: false, isAuthenticated: true}
10:52:56.119 auth-context.tsx:20 🔐 [AUTH][INFO] Proactive session refresh succeeded 
10:52:56.120 auth-context.tsx:20 🔐 [AUTH][INFO] TOKEN_REFRESHED — invalidating queries (deferred) 
10:52:56.121 error-logger.ts:38 🔐 [DIAG][AUTH] INVALIDATE_QUERIES:TOKEN_REFRESHED 
10:52:56.121 use-driver-record.ts:24 🔍 useDriverRecord: Looking up driver for {authId: '0dac767c-4452-4987-acef-3c0dfafa22b3', email: 'albert@mat.com'}
10:52:56.123 auth-context.tsx:32 🐛 [AUTH][DEBUG] fetchProfile called {userEmail: 'albert@mat.com', version: 8}
10:52:56.128 auth-context.tsx:32 🐛 [AUTH][DEBUG] fetchProfile called {userEmail: 'albert@mat.com', version: 9}
10:52:56.498 use-driver-record.ts:39 ✅ useDriverRecord: Found driver by auth_user_id: 33a96d03-8d26-4ece-ab91-4e011d7a350a
10:52:56.509 mobile-shell.tsx:25 🐛 [MOBILE_SHELL][DEBUG] Rendering main content {showNav: true, hasUser: true, className: 'none'}
10:52:56.509 mobile-shell.tsx:25 🐛 [MOBILE_SHELL][DEBUG] Rendering main content {showNav: true, hasUser: true, className: 'none'}
10:52:56.512 bottom-nav.tsx:24 🐛 [BOTTOM_NAV][DEBUG] Rendering BottomNav {activePath: '/', renderCount: 30}
10:52:56.512 bottom-nav.tsx:24 🐛 [BOTTOM_NAV][DEBUG] Rendering BottomNav {activePath: '/', renderCount: 31}
10:52:56.513 mobile-shell.tsx:13 📱 [MOBILE_SHELL][INFO] MobileShell unmounting 
10:52:56.513 mobile-shell.tsx:13 📱 [MOBILE_SHELL][INFO] MobileShell mounted {showNav: true, hasChildren: true, renderCount: 31}
10:52:56.521 auth-context.tsx:20 🔐 [AUTH][INFO] Profile fetched successfully {user_id: 40, username: 'albert.zunga', role: 'Driver'}
10:52:56.522 use-driver-record.ts:24 🔍 useDriverRecord: Looking up driver for {authId: '0dac767c-4452-4987-acef-3c0dfafa22b3', email: 'albert@mat.com'}
10:52:56.529 mobile-shell.tsx:25 🐛 [MOBILE_SHELL][DEBUG] Rendering main content {showNav: true, hasUser: true, className: 'none'}
10:52:56.529 mobile-shell.tsx:25 🐛 [MOBILE_SHELL][DEBUG] Rendering main content {showNav: true, hasUser: true, className: 'none'}
10:52:56.531 bottom-nav.tsx:24 🐛 [BOTTOM_NAV][DEBUG] Rendering BottomNav {activePath: '/', renderCount: 32}
10:52:56.531 bottom-nav.tsx:24 🐛 [BOTTOM_NAV][DEBUG] Rendering BottomNav {activePath: '/', renderCount: 33}
10:52:56.532 mobile-shell.tsx:13 📱 [MOBILE_SHELL][INFO] MobileShell unmounting 
10:52:56.532 mobile-shell.tsx:13 📱 [MOBILE_SHELL][INFO] MobileShell mounted {showNav: true, hasChildren: true, renderCount: 33}
10:52:56.891 HomePage.tsx:196 📊 HomePage: Assignments found: 1 for driver_id: 0dac767c-4452-4987-acef-3c0dfafa22b3
10:52:56.927 use-driver-record.ts:39 ✅ useDriverRecord: Found driver by auth_user_id: 33a96d03-8d26-4ece-ab91-4e011d7a350a
10:52:57.092 HomePage.tsx:196 📊 HomePage: Assignments found: 1 for driver_id: 0dac767c-4452-4987-acef-3c0dfafa22b3



## NAVIGATING TO DIESEL THEN TO TRIPS AFTER LOGIN IN FROM HOM SCREEN 


mobile-shell.tsx:25 🐛 [MOBILE_SHELL][DEBUG] Rendering main content {showNav: true, hasUser: true, className: 'none'}
10:53:55.811 bottom-nav.tsx:24 🐛 [BOTTOM_NAV][DEBUG] Rendering BottomNav {activePath: '/diesel', renderCount: 4}
10:53:55.811 bottom-nav.tsx:24 🐛 [BOTTOM_NAV][DEBUG] Rendering BottomNav {activePath: '/diesel', renderCount: 5}
10:53:55.813 mobile-shell.tsx:13 📱 [MOBILE_SHELL][INFO] MobileShell unmounting 
10:53:55.813 mobile-shell.tsx:13 📱 [MOBILE_SHELL][INFO] MobileShell mounted {showNav: true, hasChildren: true, renderCount: 5}
10:53:56.081 DieselPage.tsx:42 ⛽ [DIESEL][INFO] Found 4 diesel records 
10:53:56.082 DieselPage.tsx:54 🐛 [DIESEL][DEBUG] Stats computed {totalLitres: 1443, avgKmPerLitre: 1.5516285516285517, flaggedCount: 3}
10:53:56.083 DieselPage.tsx:54 🐛 [DIESEL][DEBUG] Stats computed {totalLitres: 1443, avgKmPerLitre: 1.5516285516285517, flaggedCount: 3}
10:53:56.083 mobile-shell.tsx:25 🐛 [MOBILE_SHELL][DEBUG] Rendering main content {showNav: true, hasUser: true, className: 'none'}
10:53:56.084 mobile-shell.tsx:25 🐛 [MOBILE_SHELL][DEBUG] Rendering main content {showNav: true, hasUser: true, className: 'none'}
10:53:56.091 bottom-nav.tsx:24 🐛 [BOTTOM_NAV][DEBUG] Rendering BottomNav {activePath: '/diesel', renderCount: 6}
10:53:56.092 bottom-nav.tsx:24 🐛 [BOTTOM_NAV][DEBUG] Rendering BottomNav {activePath: '/diesel', renderCount: 7}
10:53:56.100 mobile-shell.tsx:13 📱 [MOBILE_SHELL][INFO] MobileShell unmounting 
10:53:56.101 mobile-shell.tsx:13 📱 [MOBILE_SHELL][INFO] MobileShell mounted {showNav: true, hasChildren: true, renderCount: 7}
10:54:07.891 bottom-nav.tsx:12 🧭 [BOTTOM_NAV][INFO] Navigation item clicked {href: '/trip', label: 'Trips', currentPath: '/diesel', isActive: false}
10:54:07.895 TripPage.tsx:120 🚛 TripsPage Debug Info
10:54:07.895 TripPage.tsx:121 User: {id: '0dac767c-4452-4987-acef-3c0dfafa22b3', email: 'albert@mat.com'}
10:54:07.895 TripPage.tsx:122 Session: Active
10:54:07.895 TripPage.tsx:124 Session expires: 4/15/2026, 11:53:44 AM
10:54:07.896 installHook.js:1 🚛 TripsPage Debug Info
10:54:07.896 installHook.js:1 User: {id: '0dac767c-4452-4987-acef-3c0dfafa22b3', email: 'albert@mat.com'}
10:54:07.896 installHook.js:1 Session: Active
10:54:07.896 installHook.js:1 Session expires: 4/15/2026, 11:53:44 AM
10:54:07.897 mobile-shell.tsx:25 🐛 [MOBILE_SHELL][DEBUG] Rendering main content {showNav: true, hasUser: true, className: 'none'}
10:54:07.897 mobile-shell.tsx:25 🐛 [MOBILE_SHELL][DEBUG] Rendering main content {showNav: true, hasUser: true, className: 'none'}
10:54:07.899 bottom-nav.tsx:24 🐛 [BOTTOM_NAV][DEBUG] Rendering BottomNav {activePath: '/trip', renderCount: 1}
10:54:07.900 bottom-nav.tsx:24 🐛 [BOTTOM_NAV][DEBUG] Rendering BottomNav {activePath: '/trip', renderCount: 1}
10:54:07.905 use-realtime.ts:12 🔌 [REALTIME][INFO] Cleaning up vehicle assignment subscription 
10:54:07.906 use-realtime.ts:24 🐛 [REALTIME][DEBUG] Vehicle assignment subscription status {status: 'CLOSED'}
10:54:07.906 use-realtime.ts:12 🔌 [REALTIME][INFO] Cleaning up diesel realtime sync 
10:54:07.907 use-realtime.ts:24 🐛 [REALTIME][DEBUG] Diesel realtime subscription status {status: 'CLOSED'}
10:54:07.908 mobile-shell.tsx:13 📱 [MOBILE_SHELL][INFO] MobileShell unmounting 
10:54:07.909 bottom-nav.tsx:12 🧭 [BOTTOM_NAV][INFO] BottomNav unmounting 
10:54:07.909 bottom-nav.tsx:12 🧭 [BOTTOM_NAV][INFO] BottomNav mounted {initialPath: '/trip', navItemsCount: 4, navItems: Array(4)}
10:54:07.909 mobile-shell.tsx:13 📱 [MOBILE_SHELL][INFO] MobileShell mounted {showNav: true, hasChildren: true, renderCount: 1}
10:54:07.910 mobile-shell.tsx:25 🐛 [MOBILE_SHELL][DEBUG] Auth state in MobileShell {isLoading: false, hasError: false, errorMessage: undefined, hasUser: true, userEmail: 'albert@mat.com', …}
10:54:07.910 mobile-shell.tsx:25 🐛 [MOBILE_SHELL][DEBUG] Loading state changed {isLoading: false, isAuthenticated: true}
10:54:07.910 TripPage.tsx:157 📅 TripsPage: Date range changed {dateFrom: '2026-03-31', dateTo: '2026-04-29', filterMode: 'month'}
10:54:07.911 TripPage.tsx:371 ⏳ TripsPage: Loading states {isLoadingVehicle: false, isLoadingTrips: false, isLoadingFreight: false, isLoading: false}
10:54:07.911 bottom-nav.tsx:12 🧭 [BOTTOM_NAV][INFO] BottomNav unmounting 
10:54:07.911 mobile-shell.tsx:13 📱 [MOBILE_SHELL][INFO] MobileShell unmounting 
10:54:07.912 bottom-nav.tsx:12 🧭 [BOTTOM_NAV][INFO] BottomNav mounted {initialPath: '/trip', navItemsCount: 4, navItems: Array(4)}
10:54:07.912 mobile-shell.tsx:13 📱 [MOBILE_SHELL][INFO] MobileShell mounted {showNav: true, hasChildren: true, renderCount: 1}
10:54:07.912 mobile-shell.tsx:25 🐛 [MOBILE_SHELL][DEBUG] Auth state in MobileShell {isLoading: false, hasError: false, errorMessage: undefined, hasUser: true, userEmail: 'albert@mat.com', …}
10:54:07.913 mobile-shell.tsx:25 🐛 [MOBILE_SHELL][DEBUG] Loading state changed {isLoading: false, isAuthenticated: true}
10:54:07.913 TripPage.tsx:157 📅 TripsPage: Date range changed {dateFrom: '2026-03-31', dateTo: '2026-04-29', filterMode: 'month'}
10:54:07.913 TripPage.tsx:371 ⏳ TripsPage: Loading states {isLoadingVehicle: false, isLoadingTrips: false, isLoadingFreight: false, isLoading: false}


### THEN MOVING BACK TO HOME SCREEN 


HomePage.tsx:113 🏠 HomePage Debug Info
10:55:32.196 HomePage.tsx:114 User: {id: '0dac767c-4452-4987-acef-3c0dfafa22b3', email: 'albert@mat.com'}
10:55:32.196 HomePage.tsx:115 Profile: null
10:55:32.198 installHook.js:1 🏠 HomePage Debug Info
10:55:32.198 installHook.js:1 User: {id: '0dac767c-4452-4987-acef-3c0dfafa22b3', email: 'albert@mat.com'}
10:55:32.198 installHook.js:1 Profile: null
10:55:32.200 mobile-shell.tsx:25 🐛 [MOBILE_SHELL][DEBUG] Rendering main content {showNav: true, hasUser: true, className: 'none'}
10:55:32.200 mobile-shell.tsx:25 🐛 [MOBILE_SHELL][DEBUG] Rendering main content {showNav: true, hasUser: true, className: 'none'}
10:55:32.204 bottom-nav.tsx:24 🐛 [BOTTOM_NAV][DEBUG] Rendering BottomNav {activePath: '/', renderCount: 1}
10:55:32.204 bottom-nav.tsx:24 🐛 [BOTTOM_NAV][DEBUG] Rendering BottomNav {activePath: '/', renderCount: 1}
10:55:32.211 use-realtime.ts:12 🔌 [REALTIME][INFO] Cleaning up vehicle assignment subscription 
10:55:32.212 use-realtime.ts:24 🐛 [REALTIME][DEBUG] Vehicle assignment subscription status {status: 'CLOSED'}
10:55:32.212 mobile-shell.tsx:13 📱 [MOBILE_SHELL][INFO] MobileShell unmounting 
10:55:32.213 bottom-nav.tsx:12 🧭 [BOTTOM_NAV][INFO] BottomNav unmounting 
10:55:32.213 bottom-nav.tsx:12 🧭 [BOTTOM_NAV][INFO] BottomNav mounted {initialPath: '/', navItemsCount: 4, navItems: Array(4)}
10:55:32.214 mobile-shell.tsx:13 📱 [MOBILE_SHELL][INFO] MobileShell mounted {showNav: true, hasChildren: true, renderCount: 1}
10:55:32.214 mobile-shell.tsx:25 🐛 [MOBILE_SHELL][DEBUG] Auth state in MobileShell {isLoading: false, hasError: false, errorMessage: undefined, hasUser: true, userEmail: 'albert@mat.com', …}
10:55:32.214 mobile-shell.tsx:25 🐛 [MOBILE_SHELL][DEBUG] Loading state changed {isLoading: false, isAuthenticated: true}
10:55:32.214 use-driver-record.ts:24 🔍 useDriverRecord: Looking up driver for {authId: '0dac767c-4452-4987-acef-3c0dfafa22b3', email: 'albert@mat.com'}
10:55:32.215 use-realtime.ts:12 🔌 [REALTIME][INFO] Setting up vehicle assignment subscription {userId: '0dac767c-4452-4987-acef-3c0dfafa22b3'}
10:55:32.216 use-realtime.ts:24 🐛 [REALTIME][DEBUG] Skipping diesel realtime sync {hasDriverId: true, hasFleetNumber: false}
10:55:32.216 use-realtime.ts:24 🐛 [REALTIME][DEBUG] Skipping trips realtime sync - no vehicle ID 
10:55:32.217 bottom-nav.tsx:12 🧭 [BOTTOM_NAV][INFO] BottomNav unmounting 
10:55:32.217 mobile-shell.tsx:13 📱 [MOBILE_SHELL][INFO] MobileShell unmounting 
10:55:32.217 use-realtime.ts:12 🔌 [REALTIME][INFO] Cleaning up vehicle assignment subscription 
10:55:32.217 use-realtime.ts:24 🐛 [REALTIME][DEBUG] Vehicle assignment subscription status {status: 'CLOSED'}
10:55:32.218 bottom-nav.tsx:12 🧭 [BOTTOM_NAV][INFO] BottomNav mounted {initialPath: '/', navItemsCount: 4, navItems: Array(4)}
10:55:32.218 mobile-shell.tsx:13 📱 [MOBILE_SHELL][INFO] MobileShell mounted {showNav: true, hasChildren: true, renderCount: 1}
10:55:32.218 mobile-shell.tsx:25 🐛 [MOBILE_SHELL][DEBUG] Auth state in MobileShell {isLoading: false, hasError: false, errorMessage: undefined, hasUser: true, userEmail: 'albert@mat.com', …}
10:55:32.218 mobile-shell.tsx:25 🐛 [MOBILE_SHELL][DEBUG] Loading state changed {isLoading: false, isAuthenticated: true}
10:55:32.218 use-realtime.ts:12 🔌 [REALTIME][INFO] Setting up vehicle assignment subscription {userId: '0dac767c-4452-4987-acef-3c0dfafa22b3'}
10:55:32.219 use-realtime.ts:24 🐛 [REALTIME][DEBUG] Skipping diesel realtime sync {hasDriverId: true, hasFleetNumber: false}
10:55:32.219 use-realtime.ts:24 🐛 [REALTIME][DEBUG] Skipping trips realtime sync - no vehicle ID 
10:55:32.415 use-realtime.ts:24 🐛 [REALTIME][DEBUG] Vehicle assignment subscription status {status: 'SUBSCRIBED'}
10:55:32.635 use-driver-record.ts:39 ✅ useDriverRecord: Found driver by auth_user_id: 33a96d03-8d26-4ece-ab91-4e011d7a350a