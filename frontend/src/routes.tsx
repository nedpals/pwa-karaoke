import { createBrowserRouter, redirect } from "react-router";

import HomePage from "./pages/HomePage";
import ControllerPage from "./pages/ControllerPage";
import PlayerPage from "./pages/PlayerPage";

const router = createBrowserRouter([
  {
    path: "/",
    Component: HomePage,
  },
  // Joining and creating both happen on the home screen now. Kept so old links
  // and bookmarks land somewhere useful instead of the SPA fallback.
  {
    path: "/join",
    loader: () => redirect("/"),
  },
  {
    path: "/create",
    loader: () => redirect("/"),
  },
  {
    path: "/controller",
    Component: ControllerPage,
  },
  {
    path: "/remote",
    Component: ControllerPage,
  },
  {
    path: "/player",
    Component: PlayerPage,
  },
  // The server and service worker answer unknown navigations with the app shell,
  // so unmatched paths land here instead of a router error screen.
  {
    path: "*",
    loader: () => redirect("/"),
  },
]);

export default router;
