// src/File.js
import React, { useState, useEffect } from 'react';

function File({ fileHandle, fileName, mode, onClose }) {
  const [fileContent, setFileContent] = useState('');
  const [editingContent, setEditingContent] = useState('');

  useEffect(() => {
    const fetchFileContent = async () => {
      const file = await fileHandle.getFile();
      const content = await file.text();
      setFileContent(content);
      setEditingContent(content);
    };
    fetchFileContent();
  }, [fileHandle]);

  const handleSaveFile = async () => {
    const writable = await fileHandle.createWritable();
    await writable.write(editingContent);
    await writable.close();
    alert('File saved successfully!');
  };

  return (
    <div className='file panel'>
      <h3>
        {fileName} ({mode === 'view' ? 'View Mode' : 'Edit Mode'})
        
        <button onClick={onClose}>❌</button>
      </h3>

      {mode === 'view' ? (
        <div>
          <pre>{fileContent}</pre>
        </div>
      ) : (
        <div>
          <textarea
            style={{ width: '100%', height: '200px' }}
            value={editingContent}
            onChange={(e) => setEditingContent(e.target.value)}
          />
          <button onClick={handleSaveFile}>Save</button>
        </div>
      )}

    </div>
  );
}

export default File;
