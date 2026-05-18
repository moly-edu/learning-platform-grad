import { afterEach } from "vitest";

afterEach(() => {
  process.env.NODE_ENV = "test";
});
