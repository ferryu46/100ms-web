import React, { Suspense, useEffect } from "react";
import {
  BrowserRouter as Router,
  Navigate,
  Route,
  Routes,
  useParams,
} from "react-router-dom";
import {
  HMSRoomProvider,
  selectIsConnectedToRoom,
  useHMSActions,
  useHMSStore,
} from "@100mslive/react-sdk";
import { Box, HMSThemeProvider } from "@100mslive/react-ui";
import { AppData } from "./components/AppData/AppData.jsx";
import { BeamSpeakerLabelsLogging } from "./components/AudioLevel/BeamSpeakerLabelsLogging.jsx";
import { ErrorBoundary } from "./components/ErrorBoundary.jsx";
import ErrorPage from "./components/ErrorPage.jsx";
import FullPageProgress from "./components/FullPageProgress.jsx";
import { Init } from "./components/init/Init.jsx";
import { KeyboardHandler } from "./components/Input/KeyboardInputManager.js";
import { Notifications } from "./components/Notifications/index.jsx";
import PostLeave from "./components/PostLeave.jsx";
import { ToastContainer } from "./components/Toast/ToastContainer.jsx";
import { hmsActions, hmsNotifications, hmsStats, hmsStore } from "./hms.js";
import JoinForm from "./JoinForm.jsx";
import { Confetti } from "./plugins/confetti.jsx";
import { RemoteStopScreenshare } from "./plugins/RemoteStopScreenshare.jsx";
import { getRoutePrefix, shadeColor } from "./common/utils.js";
import { FeatureFlags } from "./services/FeatureFlags.jsx";
import "./base.css";
import "./index.css";

const Conference = React.lazy(() => import("./components/conference.jsx"));
const PreviewScreen = React.lazy(() =>
  import("./components/PreviewScreen.jsx")
);

const defaultTokenEndpoint = process.env.REACT_APP_TOKEN_GENERATION_ENDPOINT;
const envPolicyConfig = JSON.parse(process.env.REACT_APP_POLICY_CONFIG || "{}");

let appName;
if (window.location.host.includes("localhost")) {
  appName = "localhost";
} else {
  appName = window.location.host.split(".")[0];
}

document.title =
  process.env.REACT_APP_TITLE || `${appName}'s ${document.title}`;

export function EdtechComponent({
  tokenEndpoint = defaultTokenEndpoint,
  themeConfig: {
    aspectRatio = "1-1",
    font = "Roboto",
    color = "#2F80FF",
    theme = "dark",
    logo = "",
    headerPresent = "false",
    metadata = "",
    recordingUrl = "",
  },
  policyConfig = envPolicyConfig,
  getDetails = () => {},
  authTokenByRoomCodeEndpoint = "",
}) {
  const { 0: width, 1: height } = aspectRatio
    .split("-")
    .map(el => parseInt(el));

  return (
    <ErrorBoundary>
      <HMSThemeProvider
        themeType={theme}
        aspectRatio={getAspectRatio({ width, height })}
        theme={{
          colors: {
            brandDefault: color,
            brandDark: shadeColor(color, -30),
            brandLight: shadeColor(color, 30),
            brandDisabled: shadeColor(color, 10),
          },
          fonts: {
            sans: [font, "Inter", "sans-serif"],
          },
        }}
      >
        <HMSRoomProvider
          isHMSStatsOn={FeatureFlags.enableStatsForNerds}
          actions={hmsActions}
          store={hmsStore}
          notifications={hmsNotifications}
          stats={hmsStats}
        >
          <AppData
            appDetails={metadata}
            policyConfig={policyConfig}
            recordingUrl={recordingUrl}
            logo={logo}
            tokenEndpoint={tokenEndpoint}
          />

          <Init />
          <Box
            css={{
              bg: "$mainBg",
              w: "100%",
              ...(headerPresent === "true"
                ? { flex: "1 1 0", minHeight: 0 }
                : { h: "100%" }),
            }}
          >
            <AppRoutes
              getDetails={getDetails}
              authTokenByRoomCodeEndpoint={authTokenByRoomCodeEndpoint}
            />
          </Box>
        </HMSRoomProvider>
      </HMSThemeProvider>
    </ErrorBoundary>
  );
}

const RedirectToPreview = ({ getDetails }) => {
  const { roomId, role } = useParams();
  useEffect(() => {
    getDetails();
  }, [roomId]); //eslint-disable-line

  console.error({ roomId, role });

  if (!roomId && !role) {
    return <Navigate to="/" />;
  }
  if (!roomId) {
    return <Navigate to="/" />;
  }
  if (["streaming", "preview", "meeting", "leave"].includes(roomId) && !role) {
    return <Navigate to="/" />;
  }

  return (
    <Navigate to={`${getRoutePrefix()}/preview/${roomId}/${role || ""}`} />
  );
};

const RouteList = ({ getDetails, authTokenByRoomCodeEndpoint }) => {
  return (
    <Routes>
      <Route path="preview">
        <Route
          path=":roomId/:role"
          element={
            <Suspense fallback={<FullPageProgress />}>
              <PreviewScreen
                authTokenByRoomCodeEndpoint={authTokenByRoomCodeEndpoint}
              />
            </Suspense>
          }
        />
        <Route
          path=":roomId"
          element={
            <Suspense fallback={<FullPageProgress />}>
              <PreviewScreen
                authTokenByRoomCodeEndpoint={authTokenByRoomCodeEndpoint}
              />
            </Suspense>
          }
        />
      </Route>
      <Route path="meeting">
        <Route
          path=":roomId/:role"
          element={
            <Suspense fallback={<FullPageProgress />}>
              <Conference />
            </Suspense>
          }
        />
        <Route
          path=":roomId"
          element={
            <Suspense fallback={<FullPageProgress />}>
              <Conference />
            </Suspense>
          }
        />
      </Route>
      <Route path="leave">
        <Route path=":roomId/:role" element={<PostLeave />} />
        <Route path=":roomId" element={<PostLeave />} />
      </Route>
      <Route
        path="/:roomId/:role"
        element={<RedirectToPreview getDetails={getDetails} />}
      />
      <Route
        path="/:roomId/"
        element={<RedirectToPreview getDetails={getDetails} />}
      />
      <Route path="*" element={<ErrorPage error="Invalid URL!" />} />
    </Routes>
  );
};

const BackSwipe = () => {
  const isConnectedToRoom = useHMSStore(selectIsConnectedToRoom);
  const hmsActions = useHMSActions();
  useEffect(() => {
    const onRouteLeave = async () => {
      if (isConnectedToRoom) {
        await hmsActions.leave();
      }
    };
    window.addEventListener("popstate", onRouteLeave);
    return () => {
      window.removeEventListener("popstate", onRouteLeave);
    };
  }, [hmsActions, isConnectedToRoom]);
  return null;
};

function AppRoutes({ getDetails, authTokenByRoomCodeEndpoint }) {
  return (
    <Router>
      <ToastContainer />
      <Notifications />
      <BackSwipe />
      <Confetti />
      <RemoteStopScreenshare />
      <KeyboardHandler />
      <BeamSpeakerLabelsLogging />
      <Routes>
        <Route
          path="/*"
          element={
            <RouteList
              getDetails={getDetails}
              authTokenByRoomCodeEndpoint={authTokenByRoomCodeEndpoint}
            />
          }
        />
        <Route
          path="/streaming/*"
          element={
            <RouteList
              getDetails={getDetails}
              authTokenByRoomCodeEndpoint={authTokenByRoomCodeEndpoint}
            />
          }
        />
      </Routes>
    </Router>
  );
}

export default function App() {
  return (
    <EdtechComponent
      themeConfig={{
        aspectRatio: process.env.REACT_APP_TILE_SHAPE,
        theme: process.env.REACT_APP_THEME,
        color: process.env.REACT_APP_COLOR,
        logo: process.env.REACT_APP_LOGO,
        font: process.env.REACT_APP_FONT,
        headerPresent: process.env.REACT_APP_HEADER_PRESENT,
        metadata: process.env.REACT_APP_DEFAULT_APP_DETAILS, // A stringified object in env
      }}
    />
  );
}
