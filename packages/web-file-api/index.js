const ensureSecureContext = () => {
  if (typeof window === "undefined") {
    throw new Error("File System Access API is not available in this environment.");
  }
  if (!window.isSecureContext) {
    throw new Error("The File System Access API requires a secure context (HTTPS or localhost).");
  }
};

export const isFileSystemAPISupported = () => {
  return (
    typeof window !== "undefined" &&
    !!window.showDirectoryPicker &&
    typeof window.FileSystemDirectoryHandle !== "undefined"
  );
};

export async function pickDirectory(options = {}) {
  ensureSecureContext();
  if (!isFileSystemAPISupported()) {
    throw new Error("The File System Access API is not supported in this browser.");
  }
  return window.showDirectoryPicker(options);
}

export async function readDirectoryEntries(directoryHandle) {
  if (!directoryHandle) {
    throw new TypeError("A FileSystemDirectoryHandle must be provided.");
  }

  const entries = [];
  for await (const entry of directoryHandle.values()) {
    entries.push({
      kind: entry.kind,
      name: entry.name,
      handle: entry
    });
  }
  entries.sort((a, b) => {
    if (a.kind === b.kind) {
      return a.name.localeCompare(b.name);
    }
    return a.kind === "directory" ? -1 : 1;
  });
  return entries;
}

export async function renameEntry(directoryHandle, currentName, newName) {
  if (!directoryHandle) {
    throw new TypeError("A FileSystemDirectoryHandle must be provided.");
  }
  if (!currentName || !newName) {
    throw new TypeError("Both the current and new names must be provided.");
  }
  if (currentName === newName) {
    return;
  }

  if (typeof directoryHandle.renameEntry === "function") {
    await directoryHandle.renameEntry(currentName, newName);
    return;
  }

  if (typeof directoryHandle.move === "function") {
    await directoryHandle.move(currentName, newName);
    return;
  }

  throw new Error("Renaming entries is not supported by this browser yet.");
}

export async function openEntryWithDefaultApp(entryHandle) {
  if (!entryHandle) {
    throw new TypeError("A FileSystemHandle must be provided.");
  }

  if (entryHandle.kind === "directory") {
    throw new Error("Cannot open a directory in an external application.");
  }

  if (typeof navigator !== "undefined" && navigator.canShare && entryHandle.getFile) {
    try {
      const file = await entryHandle.getFile();
      const data = { files: [file] };
      if (navigator.canShare(data)) {
        await navigator.share(data);
        return;
      }
    } catch (error) {
      console.warn("Sharing via Web Share API failed", error);
    }
  }

  if (typeof window !== "undefined" && entryHandle.getFile) {
    const file = await entryHandle.getFile();
    const blobUrl = URL.createObjectURL(file);
    const anchor = document.createElement("a");
    anchor.href = blobUrl;
    anchor.download = file.name;
    anchor.rel = "noopener";
    anchor.target = "_blank";
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1_000);
    return;
  }

  throw new Error("Unable to open the selected file.");
}

export async function requestReadPermission(handle) {
  if (!handle || typeof handle.requestPermission !== "function") {
    return "granted";
  }
  const permission = await handle.requestPermission({ mode: "read" });
  return permission;
}

export async function requestWritePermission(handle) {
  if (!handle || typeof handle.requestPermission !== "function") {
    return "granted";
  }
  const permission = await handle.requestPermission({ mode: "readwrite" });
  return permission;
}
