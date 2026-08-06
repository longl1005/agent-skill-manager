import { describe, expect, it } from "vitest";
import { assertReleaseVersion } from "./validate-release-version.mjs";

describe("assertReleaseVersion", () => {
  it("accepts a stable tag matching both application versions", () => {
    expect(() => assertReleaseVersion("v1.2.3", "1.2.3", "1.2.3")).not.toThrow();
  });

  it("rejects prerelease tags and version mismatches", () => {
    expect(() => assertReleaseVersion("v1.2.3-beta.1", "1.2.3-beta.1", "1.2.3-beta.1")).toThrow("stable");
    expect(() => assertReleaseVersion("v1.2.3", "1.2.3", "1.2.4")).toThrow("must match");
  });
});
