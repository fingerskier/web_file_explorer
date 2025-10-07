import { useCallback, useMemo, useState, useEffect } from "react";
import {
  StateMachine,
  State,
  StateLink,
  useStateMachine
} from "ygdrassil";
import {
  isFileSystemAPISupported,
  pickDirectory,
  readDirectoryEntries,
  renameEntry,
  openEntryWithDefaultApp,
  requestReadPermission,
  requestWritePermission
} from "web-file-api";
import "./App.css";

const STATUS_TONES = {
  info: "status-info",
  success: "status-success",
  error: "status-error"
};

export default function App() {
  const [handleStack, setHandleStack] = useState([]);
  const [entries, setEntries] = useState([]);
  const [selectedName, setSelectedName] = useState(null);
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [isSupported, setIsSupported] = useState(() => isFileSystemAPISupported());

  const directoryHandle = useMemo(() => {
    if (handleStack.length === 0) {
      return null;
    }
    return handleStack[handleStack.length - 1];
  }, [handleStack]);

  const breadcrumbs = useMemo(() => {
    return handleStack.map((handle) => handle.name);
  }, [handleStack]);

  useEffect(() => {
    setIsSupported(isFileSystemAPISupported());
  }, []);

  const showStatus = useCallback((text, tone = "info") => {
    setStatus(text ? { text, tone } : null);
  }, []);

  const refreshEntries = useCallback(
    async (handle) => {
      const targetHandle = handle ?? directoryHandle;
      if (!targetHandle) {
        setEntries([]);
        return;
      }
      try {
        const permission = await requestReadPermission(targetHandle);
        if (permission !== "granted") {
          showStatus("Read permission is required to browse this directory.", "error");
          return;
        }
        const list = await readDirectoryEntries(targetHandle);
        setEntries(list);
        setSelectedName((current) => {
          if (!current) {
            return current;
          }
          return list.some((entry) => entry.name === current) ? current : null;
        });
      } catch (error) {
        console.error(error);
        showStatus(error?.message ?? "Unable to read directory entries.", "error");
      }
    },
    [directoryHandle, showStatus]
  );

  useEffect(() => {
    if (!directoryHandle) {
      setEntries([]);
      return;
    }
    refreshEntries(directoryHandle);
  }, [directoryHandle, refreshEntries]);

  const handleDirectoryPick = useCallback(async () => {
    if (!isSupported) {
      showStatus("Your browser does not support the File System Access API.", "error");
      return;
    }
    setBusy(true);
    try {
      const handle = await pickDirectory();
      setHandleStack([handle]);
      setSelectedName(null);
      showStatus(`Loaded “${handle.name}”.`, "success");
      return handle;
    } catch (error) {
      if (error?.name === "AbortError") {
        showStatus("Directory selection was cancelled.", "info");
      } else if (error instanceof Error) {
        showStatus(error.message, "error");
      } else {
        showStatus("Unable to open the directory.", "error");
      }
    } finally {
      setBusy(false);
    }
  }, [isSupported, refreshEntries, showStatus]);

  const handleOpenEntry = useCallback(
    async (entryHandle) => {
      try {
        await openEntryWithDefaultApp(entryHandle);
        showStatus("Requested the operating system to open the file.", "info");
      } catch (error) {
        console.error(error);
        showStatus(error?.message ?? "Unable to open the selected file.", "error");
      }
    },
    [showStatus]
  );

  const renameSupported = useMemo(() => {
    return Boolean(directoryHandle?.renameEntry || directoryHandle?.move);
  }, [directoryHandle]);

  const handleEnterDirectory = useCallback(
    (childHandle) => {
      if (!childHandle) {
        return;
      }
      setHandleStack((stack) => [...stack, childHandle]);
      setSelectedName(null);
      showStatus(`Opened “${childHandle.name}”.`, "info");
    },
    [setHandleStack, setSelectedName, showStatus]
  );

  const handleNavigateUp = useCallback(() => {
    let parentName = null;
    setHandleStack((stack) => {
      if (stack.length <= 1) {
        return stack;
      }
      const nextStack = stack.slice(0, -1);
      parentName = nextStack[nextStack.length - 1]?.name ?? null;
      return nextStack;
    });
    setSelectedName(null);
    if (parentName) {
      showStatus(`Opened “${parentName}”.`, "info");
    }
  }, [setHandleStack, setSelectedName, showStatus]);

  const handleResetDirectory = useCallback(() => {
    setHandleStack([]);
    setEntries([]);
    setSelectedName(null);
    setStatus(null);
  }, [setEntries, setHandleStack, setSelectedName, setStatus]);

  return (
    <StateMachine name="explorer" initial="welcome" className="app-shell">
      <State name="welcome" transition={["browse"]}>
        <WelcomeState
          onPickDirectory={handleDirectoryPick}
          busy={busy}
          status={status}
          isSupported={isSupported}
        />
      </State>
      <State name="browse" transition={["welcome", "rename"]}>
        <BrowserState
          directoryHandle={directoryHandle}
          entries={entries}
          onRefresh={() => refreshEntries()}
          onSelectName={setSelectedName}
          selectedName={selectedName}
          status={status}
          onOpenEntry={handleOpenEntry}
          canRename={renameSupported}
          onEnterDirectory={handleEnterDirectory}
          onNavigateUp={handleNavigateUp}
          canNavigateUp={handleStack.length > 1}
          breadcrumbs={breadcrumbs}
          onResetDirectory={handleResetDirectory}
        />
      </State>
      <State name="rename" transition={["browse"]}>
        <RenameState
          directoryHandle={directoryHandle}
          entries={entries}
          onRefresh={() => refreshEntries()}
          onSelectName={setSelectedName}
          onStatus={showStatus}
          canRename={renameSupported}
        />
      </State>
    </StateMachine>
  );
}

function WelcomeState({ onPickDirectory, busy, status, isSupported }) {
  const { gotoState, setQuery } = useStateMachine();

  const handlePick = useCallback(async () => {
    const handle = await onPickDirectory();
    if (handle) {
      setQuery({ file: null });
      gotoState("browse");
    }
  }, [gotoState, onPickDirectory, setQuery]);

  return (
    <section className="panel welcome-panel">
      <header>
        <h1>Web File Explorer</h1>
        <p className="helper-text">
          Browse local directories directly from your browser. Everything stays on your device.
        </p>
      </header>
      {!isSupported && (
        <p className="status-banner status-error">
          Your browser must support the File System Access API to run this demo.
        </p>
      )}
      {status && (
        <p className={`status-banner ${STATUS_TONES[status.tone] ?? STATUS_TONES.info}`}>
          {status.text}
        </p>
      )}
      <button
        type="button"
        className="primary-button"
        onClick={handlePick}
        disabled={!isSupported || busy}
      >
        {busy ? "Opening…" : "Choose a directory"}
      </button>
      <p className="helper-text">
        After picking a folder you can share the resulting URL to revisit the same view state.
      </p>
    </section>
  );
}

function BrowserState({
  directoryHandle,
  entries,
  onRefresh,
  onSelectName,
  selectedName,
  status,
  onOpenEntry,
  canRename,
  onEnterDirectory,
  onNavigateUp,
  canNavigateUp,
  breadcrumbs,
  onResetDirectory
}) {
  const { query, setQuery } = useStateMachine();

  useEffect(() => {
    const queryName = typeof query.file === "string" && query.file.length ? query.file : null;
    if (queryName && queryName !== selectedName) {
      onSelectName(queryName);
    }
    if (!queryName && selectedName) {
      onSelectName(null);
    }
  }, [onSelectName, query.file, selectedName]);

  const selectedEntry = useMemo(
    () => entries.find((entry) => entry.name === selectedName) ?? null,
    [entries, selectedName]
  );

  useEffect(() => {
    if (!selectedEntry && selectedName) {
      setQuery({ file: null });
    }
  }, [selectedEntry, selectedName, setQuery]);

  const handleSelect = useCallback(
    (entry) => {
      if (entry.kind === "directory") {
        setQuery({ file: null });
        onEnterDirectory?.(entry.handle);
        return;
      }
      onSelectName(entry.name);
      setQuery({ file: entry.name });
    },
    [onEnterDirectory, onSelectName, setQuery]
  );

  const title = directoryHandle?.name ?? "Unselected";

  return (
    <section className="browser-grid">
      <article className="panel file-list">
        <div className="file-list-header">
          <div>
            <h1>{title}</h1>
            <p className="helper-text">{entries.length} item(s)</p>
            {breadcrumbs?.length > 1 && (
              <ol className="breadcrumbs" aria-label="Current directory">
                {breadcrumbs.map((name, index) => (
                  <li key={`${index}-${name}`}>{name}</li>
                ))}
              </ol>
            )}
          </div>
          <div className="action-row">
            {canNavigateUp && (
              <button type="button" className="action-button" onClick={onNavigateUp}>
                Up one level
              </button>
            )}
            <button type="button" className="action-button" onClick={onRefresh}>
              Refresh
            </button>
            <StateLink
              to="welcome"
              className="action-button secondary-link"
              replace
              onClick={onResetDirectory}
            >
              Choose another folder
            </StateLink>
          </div>
        </div>
        {status && (
          <p className={`status-banner ${STATUS_TONES[status.tone] ?? STATUS_TONES.info}`}>
            {status.text}
          </p>
        )}
        <div className="file-scroll">
          {entries.length === 0 ? (
            <div className="file-item">
              <span>No items available.</span>
            </div>
          ) : (
            entries.map((entry) => (
              <div
                key={`${entry.kind}-${entry.name}`}
                className={`file-item ${selectedEntry?.name === entry.name ? "active" : ""}`.trim()}
                onClick={() => handleSelect(entry)}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    handleSelect(entry);
                  }
                }}
              >
                <div className="file-meta">
                  <span>{entry.name}</span>
                  <span className="file-kind">{entry.kind}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </article>
      <article className="panel details-card">
        {selectedEntry ? (
          <>
            <div>
              <div className="detail-label">Selected item</div>
              <h2>{selectedEntry.name}</h2>
            </div>
            <div className="detail-group">
              <div className="detail-label">Kind</div>
              <span>{selectedEntry.kind}</span>
            </div>
            <div className="action-row">
              <button
                type="button"
                className="action-button"
                onClick={() => onOpenEntry(selectedEntry.handle)}
              >
                Open in default app
              </button>
              {canRename && selectedEntry.kind === "file" ? (
                <StateLink
                  to="rename"
                  className="action-button"
                  data={{ file: selectedEntry.name }}
                >
                  Rename
                </StateLink>
              ) : (
                <span className="helper-text">
                  Renaming is not supported by this browser yet.
                </span>
              )}
            </div>
          </>
        ) : (
          <p className="helper-text">
            Select a file to view its details, or open a directory to browse deeper.
          </p>
        )}
      </article>
    </section>
  );
}

function RenameState({ directoryHandle, entries, onRefresh, onSelectName, onStatus, canRename }) {
  const { gotoState, query, setQuery } = useStateMachine();
  const [value, setValue] = useState("");
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const targetName = typeof query.file === "string" && query.file.length ? query.file : null;
  const entry = useMemo(
    () => entries.find((item) => item.name === targetName) ?? null,
    [entries, targetName]
  );

  useEffect(() => {
    if (!canRename) {
      onStatus("Renaming is not supported in this browser.", "error");
      gotoState("browse");
    }
  }, [canRename, gotoState, onStatus]);

  useEffect(() => {
    setValue(targetName ?? "");
  }, [targetName]);

  useEffect(() => {
    if (!targetName) {
      gotoState("browse");
    } else if (!entry) {
      onStatus(`“${targetName}” is no longer available.`, "error");
      gotoState("browse");
    }
  }, [entry, gotoState, onStatus, targetName]);

  const handleSubmit = useCallback(
    async (event) => {
      event.preventDefault();
      if (!entry || !directoryHandle) {
        return;
      }
      if (!canRename) {
        onStatus("Renaming is not supported in this browser.", "error");
        gotoState("browse");
        return;
      }
      const nextName = value.trim();
      if (!nextName) {
        setError("Enter a new name.");
        return;
      }
      if (nextName === entry.name) {
        gotoState("browse");
        return;
      }
      setSaving(true);
      setError(null);
      try {
        const permission = await requestWritePermission(directoryHandle);
        if (permission !== "granted") {
          setError("Write permission is required to rename this file.");
          return;
        }
        await renameEntry(directoryHandle, entry.name, nextName);
        await onRefresh();
        onSelectName(nextName);
        setQuery({ file: nextName });
        onStatus(`Renamed to “${nextName}”.`, "success");
        gotoState("browse");
      } catch (err) {
        console.error(err);
        const message = err?.message ?? "Unable to rename the file.";
        setError(message);
        onStatus(message, "error");
      } finally {
        setSaving(false);
      }
    },
    [canRename, directoryHandle, entry, gotoState, onRefresh, onSelectName, onStatus, setQuery, value]
  );

  if (!entry) {
    return null;
  }

  return (
    <section className="panel rename-form">
      <div>
        <div className="detail-label">Renaming</div>
        <h2>{entry.name}</h2>
      </div>
      <form className="rename-form" onSubmit={handleSubmit}>
        <label>
          <span className="detail-label">New name</span>
          <input
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="Enter a new name"
            autoFocus
          />
        </label>
        {error && <p className="status-banner status-error">{error}</p>}
        <div className="action-row">
          <button type="submit" className="primary-button" disabled={saving}>
            {saving ? "Renaming…" : "Save"}
          </button>
          <button
            type="button"
            className="action-button"
            onClick={() => {
              setQuery({ file: entry.name });
              gotoState("browse");
            }}
          >
            Cancel
          </button>
        </div>
      </form>
    </section>
  );
}
