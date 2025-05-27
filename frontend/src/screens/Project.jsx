import React, { useState, useEffect, useContext, useRef } from 'react'
import { UserContext } from '../context/user.context'
import { useLocation } from 'react-router-dom'
import axios from '../config/axios'
import { initializeSocket, receiveMessage, sendMessage } from '../config/socket'
import Markdown from 'markdown-to-jsx'
import hljs from 'highlight.js'

function SyntaxHighlightedCode(props) {
    const ref = useRef(null)

    React.useEffect(() => {
        if (ref.current && props.className?.includes('lang-') && window.hljs) {
            window.hljs.highlightElement(ref.current)
            ref.current.removeAttribute('data-highlighted')
        }
    }, [props.className, props.children])

    return <code {...props} ref={ref} />
}

const Project = () => {
    const location = useLocation()
    const [isSidePanelOpen, setIsSidePanelOpen] = useState(false)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [selectedUserId, setSelectedUserId] = useState(new Set())
    const [project, setProject] = useState(location.state.project)
    const [message, setMessage] = useState('')
    const { user } = useContext(UserContext)
    const messageBox = useRef()

    const [users, setUsers] = useState([])
    const [messages, setMessages] = useState([])
    const [fileTree, setFileTree] = useState({})
    const [currentFile, setCurrentFile] = useState(null)
    const [openFiles, setOpenFiles] = useState([])
    const [isFileTreeCollapsed, setIsFileTreeCollapsed] = useState(false)  // New state for file tree collapse

    const handleUserClick = (id) => {
        setSelectedUserId(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    const addCollaborators = () => {
        axios.put(`${import.meta.env.VITE_API_URL}/projects/add-user`, {
            projectId: project._id,
            users: Array.from(selectedUserId)
        }).then(res => {
            console.log(res.data)
            setIsModalOpen(false)
        }).catch(console.error)
    }

    const send = () => {
        sendMessage('project-message', { message, sender: user })
        setMessages(prev => [...prev, { sender: user, message }])
        setMessage("")
    }

    const WriteAiMessage = (message) => {
        const messageObject = JSON.parse(message)
        return (
            <div className='overflow-auto bg-slate-950 text-white rounded-sm p-2'>
                <Markdown
                    children={messageObject.text}
                    options={{ overrides: { code: SyntaxHighlightedCode } }}
                />
            </div>
        )
    }

    useEffect(() => {
        initializeSocket(project._id)

        receiveMessage('project-message', data => {
            console.log(data)
            if (data.sender._id === 'ai') {
                const message = JSON.parse(data.message)
                if (message.fileTree) setFileTree(message.fileTree || {})
            }
            setMessages(prev => [...prev, data])
        })

        axios.get(`${import.meta.env.VITE_API_URL}/projects/get-project/${project._id}`).then(res => {
            setProject(res.data.project)
            setFileTree(res.data.project.fileTree || {})
        })

        axios.get(`${import.meta.env.VITE_API_URL}/users/all`).then(res => setUsers(res.data.users)).catch(console.error)
    }, [])

    const saveFileTree = (ft) => {
        axios.put(`${import.meta.env.VITE_API_URL}/projects/update-file-tree`, {
            projectId: project._id,
            fileTree: ft
        }).then(console.log).catch(console.error)
    }

    // Close an open file tab
    const closeFile = (file) => {
        setOpenFiles(prev => prev.filter(f => f !== file))
        if (currentFile === file) {
            // If closing current file, set another open file or null
            setCurrentFile(prev => {
                const others = openFiles.filter(f => f !== file)
                return others.length > 0 ? others[others.length - 1] : null
            })
        }
    }

    return (
        <main className='h-screen w-screen flex'>
            <section className="left relative flex flex-col h-screen min-w-96 bg-slate-300">
               <header className='flex justify-between items-center p-4 border-b border-gray-300 mb-4'>
  <button className='flex gap-2' onClick={() => setIsModalOpen(true)}>
    <i className="ri-add-fill mr-1"></i>
    <p>Add collaborator</p>
  </button>
  <button onClick={() => setIsSidePanelOpen(!isSidePanelOpen)} className='p-2'>
    <i className="ri-group-fill"></i>
  </button>
</header>

<div className="conversation-area pt-4 pb-10 flex-grow flex flex-col h-full relative px-4">
  <div
    ref={messageBox}
    className="message-box p-1 flex-grow flex flex-col gap-3 overflow-auto max-h-full scrollbar-hide">
    {messages.map((msg, index) => (
      <div
        key={index}
        className={`${msg.sender._id === 'ai' ? 'max-w-80' : 'max-w-52'} ${msg.sender._id === user._id.toString() && 'ml-auto'} message flex flex-col p-2 bg-slate-50 w-fit rounded-md`}
      >
        <small className='opacity-65 text-xs'>{msg.sender.email}</small>
        <div className='text-sm'>
          {msg.sender._id === 'ai'
            ? WriteAiMessage(msg.message)
            : <p>{msg.message}</p>}
        </div>
      </div>
    ))}
  </div>
  <div className="inputField w-full flex absolute bottom-0 left-0 right-0 px-4">
    <input
      value={message}
      onChange={(e) => setMessage(e.target.value)}
      className='p-2 px-4 border-none outline-none flex-grow rounded-l-md'
      type="text"
      placeholder='Enter message'
    />
    <button onClick={send} className='px-5 bg-slate-950 text-white rounded-r-md'>
      <i className="ri-send-plane-fill"></i>
    </button>
  </div>
</div>

                
                <div className={`sidePanel w-full h-full flex flex-col gap-2 bg-slate-50 absolute transition-all ${isSidePanelOpen ? 'translate-x-0' : '-translate-x-full'} top-0`}>
                    <header className='flex justify-between items-center px-4 p-2 bg-slate-200'>
                        <h1 className='font-semibold text-lg'>Collaborators</h1>
                        <button onClick={() => setIsSidePanelOpen(false)} className='p-2'>
                            <i className="ri-close-fill"></i>
                        </button>
                    </header>
                    <div className="users flex flex-col gap-2">
                        {project.users && project.users.map(user => (
                            <div key={user._id} className="user cursor-pointer hover:bg-slate-200 p-2 flex gap-2 items-center">
                                <div className='aspect-square rounded-full w-fit h-fit flex items-center justify-center p-5 text-white bg-slate-600'>
                                    <i className="ri-user-fill absolute"></i>
                                </div>
                                <h1 className='font-semibold text-lg'>{user.email}</h1>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <section className="right bg-red-50 flex-grow h-full flex">
                {/* File tree panel with collapse toggle */}
                <div className={`explorer h-full max-w-64 min-w-52 bg-slate-200 flex flex-col transition-all duration-300 ${isFileTreeCollapsed ? 'w-12' : 'w-64'}`}>
                    <div className="flex items-center justify-between p-2 bg-slate-300 border-b border-slate-400">
                        <h2 className={`font-semibold text-lg ${isFileTreeCollapsed ? 'hidden' : 'block'}`}>Files</h2>
                        <button
                            className="px-2 py-1 text-sm bg-slate-400 rounded hover:bg-slate-500"
                            onClick={() => setIsFileTreeCollapsed(prev => !prev)}
                            title={isFileTreeCollapsed ? 'Expand File Tree' : 'Collapse File Tree'}
                        >
                            {isFileTreeCollapsed ? '➤' : '⬅'}
                        </button>
                    </div>

                    {!isFileTreeCollapsed && (
                        <div className="file-tree w-full overflow-auto flex-grow">
                            {Object.keys(fileTree).map((file, index) => (
                                <button
                                    key={index}
                                    onClick={() => {
                                        setCurrentFile(file)
                                        setOpenFiles(prev => [...new Set([...prev, file])])
                                    }}
                                    className="tree-element cursor-pointer p-2 px-4 flex items-center gap-2 bg-slate-300 w-full hover:bg-slate-400"
                                >
                                    <p className='font-semibold text-lg truncate'>{file}</p>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Padding between file tree and editor */}
                <div className="w-2" />

                <div className="code-editor flex flex-col flex-grow h-full shrink">
                    <div className="top flex justify-between w-full border-b border-slate-400">
                        <div className="files flex">
                            {openFiles.map((file, index) => (
                                <div
                                    key={index}
                                    className={`open-file cursor-pointer p-2 px-4 flex items-center w-fit gap-2 bg-slate-300 ${currentFile === file ? 'bg-slate-400' : ''}`}
                                >
                                    <p onClick={() => setCurrentFile(file)} className="font-semibold text-lg">{file}</p>
                                    <button
                                        onClick={() => closeFile(file)}
                                        className="ml-2 p-1 text-sm hover:text-red-600"
                                        title="Close file"
                                    >
                                        &times;
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="bottom flex flex-grow max-w-full shrink overflow-auto">
                        {fileTree[currentFile] && (
                            <div className="code-editor-area h-full overflow-auto flex-grow bg-slate-50">
                                <pre className="hljs h-full">
                                    <code
                                        className="hljs h-full outline-none"
                                        contentEditable
                                        suppressContentEditableWarning
                                        onBlur={(e) => {
                                            const updatedContent = e.target.innerText
                                            const ft = {
                                                ...fileTree,
                                                [currentFile]: {
                                                    file: {
                                                        contents: updatedContent
                                                    }
                                                }
                                            }
                                            setFileTree(ft)
                                            saveFileTree(ft)
                                        }}
                                        dangerouslySetInnerHTML={{
                                            __html: hljs.highlight('javascript', fileTree[currentFile].file.contents).value
                                        }}
                                        style={{
                                            whiteSpace: 'pre-wrap',
                                            paddingBottom: '25rem',
                                            counterSet: 'line-numbering',
                                        }}
                                    />
                                </pre>
                            </div>
                        )}
                    </div>
                </div>
            </section>

            {isModalOpen && (
                <div className="modal absolute z-20 top-0 left-0 h-screen w-screen bg-black bg-opacity-50 flex items-center justify-center">
                    <div className="modal-content p-4 bg-white rounded-md min-w-[300px] max-h-[80vh] overflow-auto">
                        <div className="modal-header flex justify-between items-center">
                            <h2 className="text-xl font-semibold">Add Collaborators</h2>
                            <button onClick={() => setIsModalOpen(false)} className='p-2'>
                                <i className="ri-close-line"></i>
                            </button>
                        </div>
                        <div className="modal-body mt-2">
                            <ul className='flex flex-col gap-2'>
                                {users.map(u => (
                                    <li
                                        key={u._id}
                                        className={`cursor-pointer hover:bg-slate-300 p-2 rounded-md flex gap-2 items-center ${selectedUserId.has(u._id) ? 'bg-slate-300' : ''}`}
                                        onClick={() => handleUserClick(u._id)}
                                    >
                                        <i className="ri-user-fill"></i> {u.email}
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div className="modal-footer mt-4 flex justify-end gap-4">
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className='px-4 py-2 bg-gray-300 rounded hover:bg-gray-400'
                            >
                                Cancel
                            </button>
                            <button
                                onClick={addCollaborators}
                                className='px-4 py-2 bg-blue-500 rounded text-white hover:bg-blue-600'
                            >
                                Add
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    )
}

export default Project