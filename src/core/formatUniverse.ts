import type { FileFamily } from "../lib/types";

export type FormatSupportTier = "browser" | "desktop" | "inspect-only" | "blocked";

export interface FormatDefinition {
  id: string;
  label: string;
  extensions: readonly string[];
  mimeAliases: readonly string[];
  family: FileFamily;
  supportTier: FormatSupportTier;
  supportReason: string;
}

type FormatSeed = readonly [id: string, label: string, extensions: readonly string[], mimeAliases?: readonly string[]];

function formats(
  family: FileFamily,
  supportTier: FormatSupportTier,
  supportReason: string,
  seeds: readonly FormatSeed[]
): FormatDefinition[] {
  return seeds.map(([id, label, extensions, mimeAliases = []]) => ({
    id,
    label,
    extensions,
    mimeAliases,
    family,
    supportTier,
    supportReason
  }));
}

export const FORMAT_UNIVERSE: readonly FormatDefinition[] = [
  ...formats("image", "browser", "Verified browser reader and writer fixtures.", [
    ["png", "PNG", ["png"], ["image/png"]],
    ["jpeg", "JPEG", ["jpg", "jpeg"], ["image/jpeg"]],
    ["webp", "WebP", ["webp"], ["image/webp"]],
    ["bmp", "Bitmap image", ["bmp"], ["image/bmp"]]
  ]),
  ...formats("image", "browser", "Verified browser reader only; no verified writer fixture.", [
    ["gif", "GIF", ["gif"], ["image/gif"]]
  ]),
  ...formats("image", "browser", "Verified browser writer only; no verified input fixture.", [
    ["svg", "SVG", ["svg"], ["image/svg+xml"]]
  ]),
  ...formats("image", "desktop", "No verified browser reader or writer fixture; desktop ImageMagick is required.", [
    ["avif", "AVIF", ["avif"], ["image/avif"]]
  ]),
  ...formats("image", "inspect-only", "Signature recognition only; no verified browser reader or writer fixture.", [
    ["ico", "Windows icon", ["ico"], ["image/x-icon"]]
  ]),
  ...formats("image", "desktop", "Desktop ImageMagick or camera-raw engine required.", [
    ["heic", "HEIC", ["heic"], ["image/heic"]], ["heif", "HEIF", ["heif"], ["image/heif"]],
    ["tiff", "TIFF", ["tif", "tiff"], ["image/tiff"]], ["psd", "Photoshop document", ["psd"], ["image/vnd.adobe.photoshop"]],
    ["psb", "Photoshop large document", ["psb"]], ["raw", "Camera raw image", ["raw"]],
    ["dng", "Digital Negative", ["dng"], ["image/x-adobe-dng"]], ["cr2", "Canon Raw 2", ["cr2"], ["image/x-canon-cr2"]],
    ["cr3", "Canon Raw 3", ["cr3"], ["image/x-canon-cr3"]], ["nef", "Nikon Electronic Format", ["nef"], ["image/x-nikon-nef"]],
    ["arw", "Sony Alpha Raw", ["arw"], ["image/x-sony-arw"]], ["orf", "Olympus Raw", ["orf"], ["image/x-olympus-orf"]],
    ["rw2", "Panasonic Raw 2", ["rw2"], ["image/x-panasonic-rw2"]], ["raf", "Fujifilm Raw", ["raf"], ["image/x-fujifilm-raf"]],
    ["jxl", "JPEG XL", ["jxl"], ["image/jxl"]], ["jp2", "JPEG 2000", ["jp2"], ["image/jp2"]],
    ["j2c", "JPEG 2000 codestream", ["j2c"], ["image/x-j2c"]], ["jpx", "JPEG 2000 extended", ["jpx"], ["image/jpx"]],
    ["jpm", "JPEG 2000 compound", ["jpm"], ["image/jpm"]], ["jxr", "JPEG XR", ["jxr"], ["image/jxr"]],
    ["flif", "FLIF", ["flif"], ["image/flif"]], ["xcf", "GIMP image", ["xcf"], ["image/x-xcf"]],
    ["ktx", "Khronos texture", ["ktx"], ["image/ktx"]], ["ktx2", "Khronos texture 2", ["ktx2"], ["image/ktx2"]],
    ["dds", "DirectDraw surface", ["dds"], ["image/vnd.ms-dds"]], ["hdr", "Radiance HDR", ["hdr"], ["image/vnd.radiance"]],
    ["exr", "OpenEXR", ["exr"], ["image/x-exr"]], ["tga", "Truevision TGA", ["tga"], ["image/x-tga"]],
    ["qoi", "Quite OK Image", ["qoi"], ["image/qoi"]], ["bpg", "Better Portable Graphics", ["bpg"], ["image/bpg"]],
    ["icns", "Apple icon", ["icns"], ["image/icns"]], ["cur", "Windows cursor", ["cur"], ["image/x-win-bitmap"]]
  ]),

  ...formats("video", "browser", "Verified browser reader and writer fixtures.", [
    ["mp4", "MPEG-4 video", ["mp4"], ["video/mp4"]], ["webm", "WebM video", ["webm"], ["video/webm"]],
    ["mov", "QuickTime movie", ["mov"], ["video/quicktime"]]
  ]),
  ...formats("video", "browser", "Verified browser reader only; no verified video writer fixture.", [
    ["m4v", "MPEG-4 video stream", ["m4v"], ["video/x-m4v"]], ["mkv", "Matroska video", ["mkv"], ["video/x-matroska"]],
    ["mpeg-ts", "MPEG transport stream", ["mts", "m2t"], ["video/mp2t"]]
  ]),
  ...formats("video", "desktop", "Desktop FFmpeg engine required; no verified browser reader or writer fixture.", [
    ["avi", "AVI video", ["avi"], ["video/x-msvideo"]],
    ["mpeg", "MPEG program stream", ["mpeg", "mpg"], ["video/mpeg"]], ["m2v", "MPEG-2 video", ["m2v"], ["video/mpeg2"]],
    ["m2ts", "Blu-ray transport stream", ["m2ts"]], ["ogv", "Ogg video", ["ogv"], ["video/ogg"]],
    ["flv", "Flash video", ["flv"], ["video/x-flv"]], ["f4v", "Flash MP4 video", ["f4v"], ["video/mp4"]],
    ["wmv", "Windows Media Video", ["wmv"], ["video/x-ms-wmv"]], ["3g2-video", "3GPP2 video", ["3g2"], ["video/3gpp2"]],
    ["mxf", "Material Exchange Format", ["mxf"], ["application/mxf"]], ["vob", "DVD video object", ["vob"], ["video/dvd"]],
    ["rm", "RealMedia", ["rm"], ["application/vnd.rn-realmedia"]], ["rmvb", "RealMedia variable bitrate", ["rmvb"]],
    ["divx", "DivX video", ["divx"], ["video/divx"]], ["dv", "Digital Video", ["dv"], ["video/dv"]]
  ]),

  ...formats("audio", "browser", "Verified browser reader and writer fixtures.", [
    ["mp3", "MP3 audio", ["mp3"], ["audio/mpeg"]], ["wav", "Waveform audio", ["wav"], ["audio/wav"]],
    ["flac", "FLAC audio", ["flac"], ["audio/flac"]], ["aac", "AAC audio", ["aac"], ["audio/aac"]],
    ["m4a", "MPEG-4 audio", ["m4a"], ["audio/mp4"]], ["ogg", "Ogg audio", ["ogg"], ["audio/ogg"]],
    ["opus", "Opus audio", ["opus"], ["audio/opus"]], ["mp2", "MPEG Layer II audio", ["mp2"], ["audio/mpeg"]],
    ["w64", "Sony Wave64", ["w64"]], ["m4r", "MPEG-4 ringtone", ["m4r"], ["audio/mp4"]],
    ["mka", "Matroska audio", ["mka"], ["audio/x-matroska"]], ["3gp-audio", "3GPP audio", ["3gp"], ["audio/3gpp"]],
    ["aiff", "AIFF audio", ["aif", "aiff"], ["audio/aiff"]], ["caf", "Core Audio Format", ["caf"], ["audio/x-caf"]],
    ["ac3", "Dolby Digital audio", ["ac3"], ["audio/ac3"]], ["eac3", "Dolby Digital Plus audio", ["eac3", "ec3"], ["audio/eac3"]],
    ["oga", "Ogg audio stream", ["oga"], ["audio/ogg"]], ["wma", "Windows Media Audio", ["wma"], ["audio/x-ms-wma"]],
    ["wv", "WavPack audio", ["wv"], ["audio/wavpack"]], ["tta", "True Audio", ["tta"], ["audio/x-tta"]],
    ["au", "Sun audio", ["au"], ["audio/basic"]]
  ]),
  ...formats("audio", "desktop", "Desktop FFmpeg engine required; no verified browser reader or writer fixture.", [
    ["mp1", "MPEG Layer I audio", ["mp1"]], ["m4b", "MPEG-4 audiobook", ["m4b"], ["audio/mp4"]],
    ["asf-audio", "Advanced Systems Format audio", ["asf"], ["audio/x-ms-asf"]],
    ["spx", "Speex audio", ["spx"], ["audio/ogg"]],
    ["aifc", "Compressed AIFF audio", ["aifc"], ["audio/aiff"]], ["ape", "Monkey's Audio", ["ape"], ["audio/ape"]],
    ["snd", "Sound file", ["snd"], ["audio/basic"]],
    ["amr", "Adaptive Multi-Rate audio", ["amr"], ["audio/amr"]], ["qcp", "QCP audio", ["qcp"], ["audio/qcelp"]],
    ["voc", "Creative Voice audio", ["voc"], ["audio/x-voc"]], ["dsf", "DSD stream file", ["dsf"], ["audio/dsf"]],
    ["dff", "DSDIFF audio", ["dff"], ["audio/dff"]], ["midi", "MIDI sequence", ["mid", "midi"], ["audio/midi"]],
    ["it", "Impulse Tracker module", ["it"], ["audio/x-it"]], ["s3m", "Scream Tracker module", ["s3m"], ["audio/x-s3m"]],
    ["xm", "FastTracker module", ["xm"], ["audio/x-xm"]], ["mod", "ProTracker module", ["mod"], ["audio/mod"]],
    ["mpc", "Musepack audio", ["mpc"], ["audio/musepack"]]
  ]),

  ...formats("pdf", "browser", "Verified browser reader and writer fixtures.", [
    ["pdf", "PDF", ["pdf"], ["application/pdf"]]
  ]),
  ...formats("pdf", "inspect-only", "Recognized PDF companion format has no browser conversion path.", [
    ["fdf", "Forms Data Format", ["fdf"], ["application/vnd.fdf"]], ["xfdf", "XML Forms Data Format", ["xfdf"], ["application/vnd.adobe.xfdf"]]
  ]),

  ...formats("document", "browser", "Verified browser reader only; no verified writer fixture.", [
    ["docx", "Word document", ["docx"], ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"]]
  ]),
  ...formats("document", "browser", "Verified browser writer only; no verified input fixture.", [
    ["txt", "Plain text", ["txt"], ["text/plain"]], ["md", "Markdown", ["md"], ["text/markdown"]]
  ]),
  ...formats("document", "desktop", "Desktop LibreOffice or Pandoc engine required.", [
    ["doc", "Legacy Word document", ["doc"], ["application/msword"]], ["docm", "Macro-enabled Word document", ["docm"], ["application/vnd.ms-word.document.macroenabled.12"]],
    ["dotx", "Word template", ["dotx"], ["application/vnd.openxmlformats-officedocument.wordprocessingml.template"]], ["dotm", "Macro-enabled Word template", ["dotm"]],
    ["odt", "OpenDocument text", ["odt"], ["application/vnd.oasis.opendocument.text"]], ["ott", "OpenDocument text template", ["ott"]],
    ["rtf", "Rich Text Format", ["rtf"], ["application/rtf"]], ["pages", "Apple Pages document", ["pages"], ["application/vnd.apple.pages"]],
    ["wps", "Microsoft Works document", ["wps"], ["application/vnd.ms-works"]], ["wpd", "WordPerfect document", ["wpd"], ["application/vnd.wordperfect"]],
    ["tex", "TeX document", ["tex"], ["application/x-tex"]], ["latex", "LaTeX document", ["latex"], ["application/x-latex"]],
    ["org", "Org mode document", ["org"]], ["abw", "AbiWord document", ["abw"], ["application/x-abiword"]],
    ["sxw", "StarOffice Writer document", ["sxw"], ["application/vnd.sun.xml.writer"]], ["odm", "OpenDocument master document", ["odm"]],
    ["hwp", "Hangul Word Processor document", ["hwp"], ["application/x-hwp"]]
  ]),

  ...formats("spreadsheet", "browser", "Verified browser reader only; no verified writer fixture.", [
    ["xlsx", "Excel workbook", ["xlsx"], ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"]]
  ]),
  ...formats("spreadsheet", "browser", "Verified browser reader and writer fixtures.", [
    ["csv", "Comma-separated values", ["csv"], ["text/csv"]], ["tsv", "Tab-separated values", ["tsv"], ["text/tab-separated-values"]]
  ]),
  ...formats("spreadsheet", "desktop", "Desktop LibreOffice spreadsheet engine required.", [
    ["xls", "Legacy Excel workbook", ["xls"], ["application/vnd.ms-excel"]], ["xlsm", "Macro-enabled Excel workbook", ["xlsm"]],
    ["xltx", "Excel template", ["xltx"]], ["xltm", "Macro-enabled Excel template", ["xltm"]],
    ["xlsb", "Excel binary workbook", ["xlsb"]], ["ods", "OpenDocument spreadsheet", ["ods"], ["application/vnd.oasis.opendocument.spreadsheet"]],
    ["ots", "OpenDocument spreadsheet template", ["ots"]], ["numbers", "Apple Numbers spreadsheet", ["numbers"], ["application/vnd.apple.numbers"]],
    ["dif", "Data Interchange Format", ["dif"]], ["slk", "SYLK spreadsheet", ["slk"]],
    ["gnumeric", "Gnumeric spreadsheet", ["gnumeric"]], ["sxc", "StarOffice Calc spreadsheet", ["sxc"]]
  ]),

  ...formats("presentation", "browser", "Verified browser reader only; no verified presentation writer fixture.", [
    ["pptx", "PowerPoint presentation", ["pptx"], ["application/vnd.openxmlformats-officedocument.presentationml.presentation"]]
  ]),
  ...formats("presentation", "desktop", "Desktop LibreOffice presentation engine required.", [
    ["ppt", "Legacy PowerPoint presentation", ["ppt"], ["application/vnd.ms-powerpoint"]], ["pptm", "Macro-enabled PowerPoint presentation", ["pptm"]],
    ["potx", "PowerPoint template", ["potx"]], ["potm", "Macro-enabled PowerPoint template", ["potm"]],
    ["ppsx", "PowerPoint slideshow", ["ppsx"]], ["ppsm", "Macro-enabled PowerPoint slideshow", ["ppsm"]],
    ["odp", "OpenDocument presentation", ["odp"], ["application/vnd.oasis.opendocument.presentation"]], ["otp", "OpenDocument presentation template", ["otp"]],
    ["key", "Apple Keynote presentation", ["key"], ["application/vnd.apple.keynote"]], ["pez", "Prezi presentation", ["pez"]],
    ["sxi", "StarOffice Impress presentation", ["sxi"]], ["show", "Hancom presentation", ["show"]], ["shw", "Corel presentation", ["shw"]]
  ]),

  ...formats("archive", "browser", "Verified browser reader and writer fixtures with bounded ZIP inspection.", [
    ["zip", "ZIP archive", ["zip"], ["application/zip", "application/x-zip-compressed"]]
  ]),
  ...formats("archive", "desktop", "Desktop 7-Zip or archive engine required.", [
    ["7z", "7-Zip archive", ["7z"], ["application/x-7z-compressed"]], ["rar", "RAR archive", ["rar"], ["application/vnd.rar"]],
    ["tar", "TAR archive", ["tar"], ["application/x-tar"]], ["gzip", "Gzip archive", ["gz"], ["application/gzip"]],
    ["tgz", "Compressed TAR archive", ["tgz"], ["application/gzip"]], ["bzip2", "Bzip2 archive", ["bz2"], ["application/x-bzip2"]],
    ["tbz2", "Bzip2 TAR archive", ["tbz2"], ["application/x-bzip2"]], ["xz", "XZ archive", ["xz"], ["application/x-xz"]],
    ["txz", "XZ TAR archive", ["txz"]], ["zstd", "Zstandard archive", ["zst"], ["application/zstd"]],
    ["tzst", "Zstandard TAR archive", ["tzst"]], ["lz", "Lzip archive", ["lz"], ["application/x-lzip"]],
    ["lz4", "LZ4 archive", ["lz4"], ["application/x-lz4"]], ["lzh", "LZH archive", ["lzh"], ["application/x-lzh-compressed"]],
    ["lha", "LHA archive", ["lha"]], ["arj", "ARJ archive", ["arj"], ["application/x-arj"]],
    ["ace", "ACE archive", ["ace"], ["application/x-ace-compressed"]], ["cab", "Cabinet archive", ["cab"], ["application/vnd.ms-cab-compressed"]],
    ["cpio", "CPIO archive", ["cpio"], ["application/x-cpio"]], ["ar", "Unix archive", ["ar"], ["application/x-archive"]],
    ["iso", "ISO disc image", ["iso"], ["application/x-iso9660-image"]], ["jar", "Java archive", ["jar"], ["application/java-archive"]],
    ["war", "Web application archive", ["war"], ["application/java-archive"]], ["ear", "Enterprise application archive", ["ear"], ["application/java-archive"]],
    ["xpi", "Mozilla extension package", ["xpi"], ["application/x-xpinstall"]], ["crx", "Chrome extension package", ["crx"], ["application/x-chrome-extension"]],
    ["asar", "Electron ASAR archive", ["asar"], ["application/x-asar"]]
  ]),

  ...formats("data", "browser", "Verified browser reader and writer fixtures.", [
    ["json", "JSON", ["json"], ["application/json"]], ["jsonl", "JSON Lines", ["jsonl"], ["application/jsonl"]]
  ]),
  ...formats("data", "browser", "Verified browser reader only; no verified NDJSON writer fixture.", [
    ["ndjson", "Newline-delimited JSON", ["ndjson"], ["application/x-ndjson"]]
  ]),
  ...formats("data", "inspect-only", "Recognized structured data has no verified semantic conversion path.", [
    ["xml", "XML", ["xml"], ["application/xml", "text/xml"]],
    ["yaml", "YAML", ["yaml"], ["application/yaml"]], ["yml", "YAML document", ["yml"], ["text/yaml"]],
    ["toml", "TOML", ["toml"], ["application/toml"]], ["ini", "INI configuration", ["ini"], ["text/plain"]],
    ["sql", "SQL dump", ["sql"], ["application/sql"]], ["sqlite", "SQLite database", ["sqlite"], ["application/vnd.sqlite3"]],
    ["db", "Database file", ["db"]], ["parquet", "Apache Parquet", ["parquet"], ["application/vnd.apache.parquet"]],
    ["avro", "Apache Avro", ["avro"], ["application/avro"]], ["arrow", "Apache Arrow", ["arrow"], ["application/vnd.apache.arrow.file"]],
    ["orc", "Apache ORC", ["orc"], ["application/vnd.apache.orc"]], ["feather", "Feather data", ["feather"], ["application/vnd.apache.arrow.file"]],
    ["hdf5", "HDF5 data", ["h5", "hdf5"], ["application/x-hdf5"]], ["hdf", "HDF data", ["hdf"], ["application/x-hdf"]],
    ["mat", "MATLAB data", ["mat"], ["application/x-matlab-data"]], ["sav", "SPSS data", ["sav"], ["application/x-spss-sav"]],
    ["dta", "Stata data", ["dta"], ["application/x-stata"]], ["geojson", "GeoJSON", ["geojson"], ["application/geo+json"]],
    ["shp", "ESRI Shapefile", ["shp"], ["application/vnd.shp"]], ["dbf", "dBASE table", ["dbf"], ["application/x-dbf"]],
    ["ics", "iCalendar data", ["ics"], ["text/calendar"]], ["vcf", "vCard data", ["vcf"], ["text/vcard"]],
    ["pcap", "Packet capture", ["pcap"], ["application/vnd.tcpdump.pcap"]], ["dat", "Generic data file", ["dat"]]
  ]),

  ...formats("code", "inspect-only", "Recognized source code is kept as text; no semantic conversion is claimed.", [
    ["html", "HTML", ["html"], ["text/html"]], ["htm", "HTML document", ["htm"]], ["css", "CSS", ["css"], ["text/css"]],
    ["scss", "SCSS", ["scss"], ["text/x-scss"]], ["sass", "Sass", ["sass"], ["text/x-sass"]], ["less", "Less", ["less"], ["text/less"]],
    ["javascript", "JavaScript", ["js"], ["text/javascript"]], ["mjs", "JavaScript module", ["mjs"]], ["cjs", "CommonJS module", ["cjs"]],
    ["typescript", "TypeScript", ["ts"], ["text/typescript"]], ["tsx", "TypeScript JSX", ["tsx"]], ["jsx", "JavaScript JSX", ["jsx"]],
    ["python", "Python", ["py"], ["text/x-python"]], ["ruby", "Ruby", ["rb"], ["text/x-ruby"]], ["php", "PHP", ["php"], ["application/x-httpd-php"]],
    ["java", "Java source", ["java"], ["text/x-java-source"]], ["class", "Java class", ["class"], ["application/java-vm"]],
    ["c-source", "C source", ["c"], ["text/x-c"]], ["cpp", "C++ source", ["cpp"], ["text/x-c++"]], ["header", "C/C++ header", ["h"], ["text/x-c"]],
    ["csharp", "C# source", ["cs"], ["text/x-csharp"]], ["go", "Go source", ["go"], ["text/x-go"]], ["rust", "Rust source", ["rs"], ["text/x-rust"]],
    ["swift", "Swift source", ["swift"], ["text/x-swift"]], ["kotlin", "Kotlin source", ["kt"], ["text/x-kotlin"]], ["kts", "Kotlin script", ["kts"]],
    ["shell", "Shell script", ["sh"], ["application/x-sh"]], ["powershell", "PowerShell script", ["ps1"], ["text/plain"]],
    ["batch", "Windows batch script", ["bat"], ["application/x-bat"]], ["wasm", "WebAssembly module", ["wasm"], ["application/wasm"]]
  ]),

  ...formats("font", "inspect-only", "Font signature can be identified; conversion is not enabled.", [
    ["ttf", "TrueType font", ["ttf"], ["font/ttf"]], ["otf", "OpenType font", ["otf"], ["font/otf"]],
    ["woff", "Web Open Font Format", ["woff"], ["font/woff"]], ["woff2", "Web Open Font Format 2", ["woff2"], ["font/woff2"]],
    ["eot", "Embedded OpenType font", ["eot"], ["application/vnd.ms-fontobject"]], ["ttc", "TrueType collection", ["ttc"], ["font/collection"]],
    ["pfa", "PostScript Type 1 ASCII font", ["pfa"], ["application/x-font-type1"]], ["pfb", "PostScript Type 1 binary font", ["pfb"]],
    ["fnt", "Bitmap font", ["fnt"]], ["bdf", "Glyph Bitmap Distribution font", ["bdf"]], ["pcf", "Portable Compiled Format font", ["pcf"]]
  ]),

  ...formats("model3d", "desktop", "Desktop Blender or CAD engine required.", [
    ["glb", "Binary glTF model", ["glb"], ["model/gltf-binary"]], ["gltf", "glTF model", ["gltf"], ["model/gltf+json"]],
    ["obj", "Wavefront OBJ model", ["obj"], ["model/obj"]], ["stl", "STL model", ["stl"], ["model/stl"]],
    ["fbx", "Autodesk FBX model", ["fbx"], ["model/vnd.autodesk.fbx"]], ["3mf", "3D Manufacturing Format", ["3mf"], ["model/3mf"]],
    ["blend", "Blender scene", ["blend"], ["application/x-blender"]], ["dae", "COLLADA model", ["dae"], ["model/vnd.collada+xml"]],
    ["ply", "Polygon model", ["ply"], ["model/ply"]], ["step", "STEP CAD model", ["step"], ["model/step"]],
    ["stp", "STEP CAD exchange", ["stp"]], ["iges", "IGES CAD model", ["iges"], ["model/iges"]], ["igs", "IGES CAD exchange", ["igs"]],
    ["dwg", "AutoCAD drawing", ["dwg"], ["image/vnd.dwg"]], ["dxf", "Drawing Exchange Format", ["dxf"], ["image/vnd.dxf"]],
    ["skp", "SketchUp model", ["skp"], ["application/vnd.koan"]], ["usd", "Universal Scene Description", ["usd"], ["model/vnd.usd"]],
    ["usdz", "Packaged Universal Scene Description", ["usdz"], ["model/vnd.usdz+zip"]], ["abc", "Alembic scene", ["abc"]],
    ["drc", "Draco model", ["drc"], ["application/vnd.google.draco"]], ["x3d", "X3D model", ["x3d"], ["model/x3d+xml"]],
    ["vrml", "VRML model", ["vrml"], ["model/vrml"]]
  ]),

  ...formats("ebook", "browser", "Verified browser reader only through the EPUB-to-text fixture.", [
    ["epub", "EPUB ebook", ["epub"], ["application/epub+zip"]]
  ]),
  ...formats("ebook", "desktop", "Desktop Calibre engine required; no verified browser reader or writer fixture.", [
    ["mobi", "Mobipocket ebook", ["mobi"], ["application/x-mobipocket-ebook"]],
    ["azw", "Kindle ebook", ["azw"], ["application/vnd.amazon.ebook"]], ["azw3", "Kindle Format 8 ebook", ["azw3"]],
    ["kfx", "Kindle KFX ebook", ["kfx"]], ["fb2", "FictionBook ebook", ["fb2"], ["application/x-fictionbook+xml"]],
    ["cbz", "Comic Book ZIP", ["cbz"], ["application/vnd.comicbook+zip"]], ["cbr", "Comic Book RAR", ["cbr"], ["application/vnd.comicbook-rar"]],
    ["djvu", "DjVu document", ["djvu"], ["image/vnd.djvu"]], ["chm", "Compiled HTML help", ["chm"], ["application/vnd.ms-htmlhelp"]],
    ["lit", "Microsoft Reader ebook", ["lit"], ["application/x-ms-reader"]], ["pdb", "Palm database ebook", ["pdb"], ["application/vnd.palm"]]
  ]),

  ...formats("application", "blocked", "Executable or installable content is identified but never run.", [
    ["exe", "Windows executable", ["exe"], ["application/vnd.microsoft.portable-executable", "application/x-msdownload"]],
    ["msi", "Windows installer", ["msi"], ["application/x-msi"]], ["msix", "MSIX package", ["msix"], ["application/msix"]],
    ["appx", "AppX package", ["appx"], ["application/appx"]], ["apk", "Android package", ["apk"], ["application/vnd.android.package-archive"]],
    ["aab", "Android app bundle", ["aab"], ["application/x-authorware-bin"]], ["ipa", "iOS application archive", ["ipa"], ["application/x-itunes-ipa"]],
    ["app", "macOS application bundle", ["app"]], ["dmg", "Apple disk image", ["dmg"], ["application/x-apple-diskimage"]],
    ["pkg", "Installer package", ["pkg"], ["application/vnd.apple.installer+xml"]], ["deb", "Debian package", ["deb"], ["application/vnd.debian.binary-package"]],
    ["rpm", "RPM package", ["rpm"], ["application/x-rpm"]], ["appimage", "Linux AppImage", ["appimage"], ["application/vnd.appimage"]],
    ["flatpak", "Flatpak bundle", ["flatpak"], ["application/vnd.flatpak"]], ["snap", "Snap package", ["snap"], ["application/vnd.snap"]],
    ["bin", "Binary executable", ["bin"], ["application/octet-stream"]], ["run", "Linux installer script", ["run"]],
    ["com", "DOS command executable", ["com"], ["application/x-msdownload"]], ["scr", "Windows screen saver executable", ["scr"]],
    ["dll", "Dynamic-link library", ["dll"], ["application/x-msdownload"]], ["sys", "Windows system driver", ["sys"]],
    ["so", "Shared object library", ["so"], ["application/x-sharedlib"]], ["dylib", "Dynamic library", ["dylib"], ["application/x-mach-binary"]],
    ["elf", "ELF executable", ["elf"], ["application/x-elf"]], ["lnk", "Windows shortcut", ["lnk"], ["application/x-ms-shortcut"]],
    ["reg", "Windows registry script", ["reg"], ["text/x-ms-regedit"]]
  ]),

  ...formats("unknown", "inspect-only", "No reliable format fact was detected from bytes, MIME, or name.", [
    ["unknown", "Unknown format", []]
  ])
];

const formatsByExtension = new Map<string, FormatDefinition>();
const formatsByMime = new Map<string, FormatDefinition>();
const ambiguousMimes = new Set<string>();

for (const format of FORMAT_UNIVERSE) {
  for (const extension of format.extensions) formatsByExtension.set(extension, format);
  for (const mime of format.mimeAliases) {
    const normalizedMime = mime.toLowerCase();
    if (formatsByMime.has(normalizedMime)) {
      formatsByMime.delete(normalizedMime);
      ambiguousMimes.add(normalizedMime);
    } else if (!ambiguousMimes.has(normalizedMime)) {
      formatsByMime.set(normalizedMime, format);
    }
  }
}

export function normalizeExtension(extension: string): string {
  return extension.trim().toLowerCase().replace(/^\./, "");
}

export function findFormatByExtension(extension: string): FormatDefinition | undefined {
  return formatsByExtension.get(normalizeExtension(extension));
}

export function findFormatByMime(mime: string): FormatDefinition | undefined {
  return formatsByMime.get(mime.trim().toLowerCase().split(";", 1)[0]);
}

export function findFormatById(id: string): FormatDefinition | undefined {
  return FORMAT_UNIVERSE.find((format) => format.id === id);
}
