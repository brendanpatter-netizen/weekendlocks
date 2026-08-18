// app/+html.tsx
// Custom root HTML shell (only used for web.output: "static"/"server" — see
// app.json). Declares @font-face for the two display fonts directly in the
// static HTML instead of relying only on useFonts()'s JS-driven
// registration in app/_layout.tsx. Previously the browser couldn't start
// fetching either font until the JS bundle had downloaded and executed far
// enough to reach that hook — now it discovers the @font-face rules (and
// the matching <link rel="preload">) the moment it parses <head>, fetching
// them in parallel with the JS bundle instead of after it. The font files
// live in public/fonts under fixed names (rather than the hashed URLs
// Metro's require()-based asset system generates) so this file can
// reference them by a stable path across builds.
import type { PropsWithChildren } from "react";

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        {/* Mirrors the react-native-web recommended style reset Expo's
            default (uncustomized) shell applies — see necolas.github.io/react-native-web/docs/setup/#root-element */}
        <style id="expo-reset">{`
          html, body { height: 100%; }
          body { overflow: hidden; }
          #root { display: flex; height: 100%; flex: 1; }
        `}</style>
        <link rel="preload" href="/fonts/PermanentMarker-Regular.ttf" as="font" type="font/ttf" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/RobotoCondensed-900Black.ttf" as="font" type="font/ttf" crossOrigin="anonymous" />
        <style id="early-font-face">{`
          @font-face {
            font-family: 'PermanentMarker_400Regular';
            src: url('/fonts/PermanentMarker-Regular.ttf') format('truetype');
            font-display: swap;
          }
          @font-face {
            font-family: 'RobotoCondensed_900Black';
            src: url('/fonts/RobotoCondensed-900Black.ttf') format('truetype');
            font-weight: 900;
            font-display: swap;
          }
        `}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}
