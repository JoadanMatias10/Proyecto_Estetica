import fs from "fs";
import path from "path";

const appSource = fs.readFileSync(path.join(__dirname, "App.js"), "utf8");

test("keeps the complete route map after code splitting", () => {
  const routeDeclarations = appSource.match(/<Route(?=\s|>)/g) || [];

  expect(routeDeclarations).toHaveLength(73);
  expect(appSource).toContain('<Route path="/" element={<Home />} />');
  expect(appSource).toContain('<Route path="/cliente" element={<ClientLayout />}>');
  expect(appSource).toContain('<Route path="/estilista" element={<EstilistaLayout />}>');
  expect(appSource).toContain('<Route path="/admin" element={<AdminLayout />}>');
});

test("preloads home only on the direct root route and defers every screen", () => {
  const lazyScreens = appSource.match(/React\.lazy\(/g) || [];

  expect(appSource).not.toContain('import Home from "./Publico/Home";');
  expect(appSource).toContain('const importHome = () => import("./Publico/Home");');
  expect(appSource).toContain('window.location.pathname === "/"');
  expect(appSource).toContain('const Home = React.lazy(() => initialHomeImport || importHome());');
  expect(lazyScreens).toHaveLength(66);
});
