import { createBrowserRouter } from "react-router";

import HomePage from "./pages/HomePage";
import JoinPage from "./pages/JoinPage";
import CreatePage from "./pages/CreatePage";
import ControllerPage from "./pages/ControllerPage";
import PlayerPage from "./pages/PlayerPage";

const router = createBrowserRouter([
  {
    path: "/",
    Component: HomePage,
  },
  {
    path: "/join",
    Component: JoinPage,
  },
  {
    path: "/create",
    Component: CreatePage,
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
]);

export default router;
