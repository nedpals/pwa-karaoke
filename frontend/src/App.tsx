import { RouterProvider } from "react-router";
import { SWRConfig } from "swr";
import router from "./routes";

function App() {
  return (
    <SWRConfig
      value={{
        revalidateOnFocus: false,
        revalidateOnReconnect: true,
        shouldRetryOnError: false,
        errorRetryCount: 1,
      }}
    >
      <RouterProvider router={router} />
    </SWRConfig>
  );
}

export default App;
