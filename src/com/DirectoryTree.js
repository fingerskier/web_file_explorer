// src/DirectoryTree.js
import React, { useState } from 'react';
import File from './File';

function DirectoryTree({ directoryHandle }) {
  const [entries, setEntries] = useState([]);
  const [expanded, setExpanded] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileMode, setFileMode] = useState(null);

  // Function to handle directory click and filter files
  const handleDirectoryClick = async () => {
    if (expanded) {
      setExpanded(false);
      return;
    }

    if (entries.length === 0) {
      const newEntries = [];
      for await (const entry of directoryHandle.values()) {
        if (entry.name.startsWith('.')) continue;

        if (entry.kind === 'file') {
          const validExtensions = ['txt', 'md', 'csv', 'json'];
          const extension = entry.name.split('.').pop().toLowerCase();
          if (validExtensions.includes(extension)) {
            newEntries.push(entry);
          }
        } else if (entry.kind === 'directory') {
          newEntries.push(entry);
        }
      }
      setEntries(newEntries);
    }
    setExpanded(true);
  };

  // Function to handle file selection for view or edit
  const handleFileSelection = (fileHandle, fileName, mode) => {
    if (selectedFile === fileHandle) {
      // Close the file view/edit panel if the same file is clicked again
      setSelectedFile(null);
      setFileMode(null);
    } else {
      setSelectedFile(fileHandle);
      setFileMode(mode);
    }
  };

  return (
    <div>
      <div onClick={handleDirectoryClick} style={{ cursor: 'pointer' }}>
        {directoryHandle.kind === 'directory' ? '📁' : '📄'} {directoryHandle.name}
      </div>

      {expanded && entries.length > 0 && (
        <ul style={{ paddingLeft: '20px' }}>
          {entries.map((entry, index) => (
            <li key={index}>
              {entry.kind === 'directory' ? (
                <DirectoryTree directoryHandle={entry} />
              ) : (
                <div>
                  📄 {entry.name}
                  <button onClick={() => handleFileSelection(entry, entry.name, 'view')}>👁</button>
                  <button onClick={() => handleFileSelection(entry, entry.name, 'edit')}>Edit</button>

                  {/* Render File component inline below the file name */}
                  {selectedFile === entry && (
                    <File
                      fileHandle={selectedFile}
                      fileName={entry.name}
                      mode={fileMode}
                      onClose={() => setSelectedFile(null)} // Inline close handler
                    />
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default DirectoryTree;
