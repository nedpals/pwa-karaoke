import { createBrowserRouter } from "react-router";

import HomePage from "./pages/HomePage";
import ControllerPage from "./pages/ControllerPage";
import DisplayPage from "./pages/DisplayPage";
import PlayerPage from "./pages/PlayerPage";

const router = createBrowserRouter([
  {
    path: "/",
    Component: HomePage,
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
    path: "/display",
    Component: DisplayPage,
  },
  {
    path: "/player",
    Component: PlayerPage,
  },
]);

export default router;
