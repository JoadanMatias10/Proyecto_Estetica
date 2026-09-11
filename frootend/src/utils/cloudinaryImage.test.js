import {
  buildCloudinaryImageUrl,
  buildCloudinarySrcSet,
  isCloudinaryImageUrl,
} from "./cloudinaryImage";

const CLOUDINARY_IMAGE =
  "https://res.cloudinary.com/demo/image/upload/v123/carrusel/hero.jpg";

test("adds delivery transformations without changing the stored Cloudinary URL", () => {
  expect(
    buildCloudinaryImageUrl(CLOUDINARY_IMAGE, {
      crop: "fill",
      gravity: "center",
      width: 480,
      height: 747,
    })
  ).toBe(
    "https://res.cloudinary.com/demo/image/upload/c_fill,g_center,w_480,h_747,f_auto,q_auto/v123/carrusel/hero.jpg"
  );

  expect(CLOUDINARY_IMAGE).toBe(
    "https://res.cloudinary.com/demo/image/upload/v123/carrusel/hero.jpg"
  );
});

test("leaves non-Cloudinary images untouched", () => {
  const imageUrl = "https://example.com/image.jpg";

  expect(isCloudinaryImageUrl(imageUrl)).toBe(false);
  expect(buildCloudinaryImageUrl(imageUrl, { width: 800 })).toBe(imageUrl);
  expect(buildCloudinarySrcSet(imageUrl, [360, 800])).toBe("");
});

test("builds responsive width descriptors", () => {
  const srcSet = buildCloudinarySrcSet(CLOUDINARY_IMAGE, [360, 640], {
    crop: "limit",
  });

  expect(srcSet).toContain("c_limit,w_360,f_auto,q_auto");
  expect(srcSet).toContain(" 360w");
  expect(srcSet).toContain("c_limit,w_640,f_auto,q_auto");
  expect(srcSet).toContain(" 640w");
});
