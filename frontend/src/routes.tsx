import { createBrowserRouter } from "react-router";

import HomePage from "./pages/HomePage";
import ControllerPage from "./pages/ControllerPage";
import DisplayPage from "./pages/DisplayPage";

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
    path: "/display",
    Component: DisplayPage,
  },
]);

export default router;
