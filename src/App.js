// src/App.js
import React, { useState } from 'react'
import DirectoryTree from './com/DirectoryTree'

import './App.css'


export default function App() {
  const [rootDirectoryHandle, setRootDirectoryHandle] = useState(null)
  
  
  const handleDirectoryPicker = async () => {
    try {
      // Request the directory handle
      const directoryHandle = await window.showDirectoryPicker();
      setRootDirectoryHandle(directoryHandle);
    } catch (err) {
      console.error('Error accessing directory:', err);
    }
  }
  
  
  return (
    <div>
      <h1>File Manager</h1>
      <button onClick={handleDirectoryPicker}>Pick a Directory</button>
      
      {rootDirectoryHandle && (
        <DirectoryTree directoryHandle={rootDirectoryHandle} />
      )}
    </div>
  )
}