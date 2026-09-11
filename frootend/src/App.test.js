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

test("keeps the home critical and defers non-home screens", () => {
  const lazyScreens = appSource.match(/React\.lazy\(\(\) => import\(/g) || [];

  expect(appSource).toContain('import Home from "./Publico/Home";');
  expect(lazyScreens).toHaveLength(65);
});
