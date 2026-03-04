import { Providers } from "./app/Providers";
import { AppRouter } from "./app/Router";

export function App() {
  return (
    <Providers>
      <AppRouter />
    </Providers>
  );
}
