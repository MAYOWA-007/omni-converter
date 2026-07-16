export type ImageInputFixtureId = "jpeg" | "gif" | "webp" | "bmp";

const IMAGE_FIXTURES: Readonly<Record<ImageInputFixtureId, { name: string; type: string; base64: string }>> = {
  jpeg: {
    name: "pattern-jpeg.jpg",
    type: "image/jpeg",
    base64: "/9j/4AAQSkZJRgABAgAAAQABAAD//gAQTGF2YzYyLjExLjEwMAD/2wBDAAgEBAQEBAUFBQUFBQYGBgYGBgYGBgYGBgYHBwcICAgHBwcGBgcHCAgICAkJCQgICAgJCQoKCgwMCwsODg4RERT/xABsAAEBAAAAAAAAAAAAAAAAAAACBAEBAQEAAAAAAAAAAAAAAAAABAIFEAACAgICAwEBAAAAAAAAAAACAwQFARIHFAAGtXU0EQACAQMDAgcBAQAAAAAAAAAEAgMGAQUUEhEAE7Z0tXY2FTQmB//AABEIAAYACAMBEgACEgADEgD/2gAMAwEAAhEDEQA/AJeJmaV1CdY1s50Sb6QKMT8dAYfemzBeEZiTsCAJ5IUqdkQXstKyIW64HA4Q/hr/ANHjX6dn4Yp9APSNyZJMD9qXU6yNhLatqi0RgixJnbO+J2ID3nQHlslwk821Yub2aaz/ACf5R5+uvUMZ1sVGN/Y04M4YSYsyn4ZpZkbeSfpqcysw5JoNxkguRBoRiYbMZP2yAA7LLbaskaKn+R0V7VbwhU3X/9k="
  },
  gif: {
    name: "pattern-gif.gif",
    type: "image/gif",
    base64: "R0lGODlhCAAGAPcfMQAAACQAAEgAAGwAAJAAALQAANgAAPwAAAAkACQkAEgkAGwkAJAkALQkANgkAPwkAABIACRIAEhIAGxIAJBIALRIANhIAPxIAABsACRsAEhsAGxsAJBsALRsANhsAPxsAACQACSQAEiQAGyQAJCQALSQANiQAPyQAAC0ACS0AEi0AGy0AJC0ALS0ANi0APy0AADYACTYAEjYAGzYAJDYALTYANjYAPzYAAD8ACT8AEj8AGz8AJD8ALT8ANj8APz8AAAAVSQAVUgAVWwAVZAAVbQAVdgAVfwAVQAkVSQkVUgkVWwkVZAkVbQkVdgkVfwkVQBIVSRIVUhIVWxIVZBIVbRIVdhIVfxIVQBsVSRsVUhsVWxsVZBsVbRsVdhsVfxsVQCQVSSQVUiQVWyQVZCQVbSQVdiQVfyQVQC0VSS0VUi0VWy0VZC0VbS0Vdi0Vfy0VQDYVSTYVUjYVWzYVZDYVbTYVdjYVfzYVQD8VST8VUj8VWz8VZD8VbT8Vdj8Vfz8VQAAqiQAqkgAqmwAqpAAqrQAqtgAqvwAqgAkqiQkqkgkqmwkqpAkqrQkqtgkqvwkqgBIqiRIqkhIqmxIqpBIqrRIqthIqvxIqgBsqiRsqkhsqmxsqpBsqrRsqthsqvxsqgCQqiSQqkiQqmyQqpCQqrSQqtiQqvyQqgC0qiS0qki0qmy0qpC0qrS0qti0qvy0qgDYqiTYqkjYqmzYqpDYqrTYqtjYqvzYqgD8qiT8qkj8qmz8qpD8qrT8qtj8qvz8qgAA/yQA/0gA/2wA/5AA/7QA/9gA//wA/wAk/yQk/0gk/2wk/5Ak/7Qk/9gk//wk/wBI/yRI/0hI/2xI/5BI/7RI/9hI//xI/wBs/yRs/0hs/2xs/5Bs/7Rs/9hs//xs/wCQ/ySQ/0iQ/2yQ/5CQ/7SQ/9iQ//yQ/wC0/yS0/0i0/2y0/5C0/7S0/9i0//y0/wDY/yTY/0jY/2zY/5DY/7TY/9jY//zY/wD8/yT8/0j8/2z8/5D8/7T8/9j8//z8/yH/C05FVFNDQVBFMi4wAwEAAAAh+QQEZAAfACwAAAAACAAGAAAIKQABHMDxA9gxfP8EHgP2A8eBhAcWNnyokKHDfwdu8MCDDxqxQxUn/gsIADs="
  },
  webp: {
    name: "pattern-webp.webp",
    type: "image/webp",
    base64: "UklGRpAAAABXRUJQVlA4IIQAAABwAgCdASoIAAYAAgA0JbACdDKJf2A+AAFpPdocAP72/2Ejim6pX/hhtRvMLW/M7/g1/nGx6Nm6N3IMc3o/IkNJB2F/P81/q+vl92RZkfIub2BVKvq/5x7eNkxjcNtcspG1/c3sa5vVw/sA/X/vVsDlX/5Y/Pf7ONz9KGD+Jj+5v/DQAAA="
  },
  bmp: {
    name: "pattern-bmp.bmp",
    type: "image/bmp",
    base64: "Qk3GAAAAAAAAADYAAAAoAAAACAAAAAYAAAABABgAAAAAAJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD//wD//wAAAP//AP8AAAD/////AAD/AMD/AP9/QP8A//8A/z8A/wCAvwD/AAAAAAD//wD//wAAAP//AP8AAAD/////AAAAAAD//wD//wAAAP//AP8AAAD/////AAAAAAD//wD//wAAAP//AP8AAAD/////AAAAAAD/AP8AAP///wAA/wD///8A////"
  }
};

export function imageInputFixture(fixtureId: ImageInputFixtureId) {
  const fixture = IMAGE_FIXTURES[fixtureId];
  const binary = atob(fixture.base64);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new File([bytes], fixture.name, { type: fixture.type, lastModified: 1_700_000_000_000 });
}
