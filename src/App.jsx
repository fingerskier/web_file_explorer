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
  const [directoryHandle, setDirectoryHandle] = useState(null);
  const [entries, setEntries] = useState([]);
  const [selectedName, setSelectedName] = useState(null);
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [isSupported, setIsSupported] = useState(() => isFileSystemAPISupported());

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

  const handleDirectoryPick = useCallback(async () => {
    if (!isSupported) {
      showStatus("Your browser does not support the File System Access API.", "error");
      return;
    }
    setBusy(true);
    try {
      const handle = await pickDirectory();
      setDirectoryHandle(handle);
      setSelectedName(null);
      await refreshEntries(handle);
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
  canRename
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
      onSelectName(entry.name);
      setQuery({ file: entry.name });
    },
    [onSelectName, setQuery]
  );

  const title = directoryHandle?.name ?? "Unselected";

  return (
    <section className="browser-grid">
      <article className="panel file-list">
        <div className="file-list-header">
          <div>
            <h1>{title}</h1>
            <p className="helper-text">{entries.length} item(s)</p>
          </div>
          <div className="action-row">
            <button type="button" className="action-button" onClick={onRefresh}>
              Refresh
            </button>
            <StateLink to="welcome" className="action-button secondary-link" replace>
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
              <div className="detail-label">Selected file</div>
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
              {canRename ? (
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
            Select a file from the list to view details and actions.
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
