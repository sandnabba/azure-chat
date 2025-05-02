import React, { useEffect, useState, useCallback } from 'react';
import './Sidebar.css';
import { useChat } from '../contexts/ChatContext';
import AddChannelModal from './AddChannelModal';
import DeleteChannelModal from './DeleteChannelModal';

interface SidebarProps {
  selectedRoom: string;
  onSelectRoom: (room: string) => void;
}

interface ChatRoomData {
  id: string;
  name: string;
  description: string;
}

const Sidebar: React.FC<SidebarProps> = ({ selectedRoom, onSelectRoom }) => {
  const { activeUsers } = useChat(); // Get activeUsers from ChatContext
  const [rooms, setRooms] = useState<ChatRoomData[]>([]);
  const [isAddChannelModalOpen, setIsAddChannelModalOpen] = useState(false);
  const [isDeleteChannelModalOpen, setIsDeleteChannelModalOpen] = useState(false);
  const [channelToDelete, setChannelToDelete] = useState<ChatRoomData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0); // To force refresh

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';

  // Fetch rooms from server with better error handling
  const fetchRooms = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Get server data
      const response = await fetch(`${apiUrl}/api/rooms`);
      if (response.ok) {
        const serverData = await response.json();
        console.log('Fetched channels from server:', serverData);
        
        // Ensure "general" channel is always present
        if (!serverData.some((room: ChatRoomData) => room.id === 'general')) {
          serverData.push({
            id: 'general',
            name: 'General',
            description: 'Public chat room for everyone'
          });
        }
        
        // Sort channels alphabetically, but keep general first
        serverData.sort((a: ChatRoomData, b: ChatRoomData) => {
          if (a.id === 'general') return -1;
          if (b.id === 'general') return 1;
          return a.name.localeCompare(b.name);
        });
        
        // Update state
        setRooms(serverData);
        
        // Select first room if none selected
        if (!selectedRoom && serverData.length > 0) {
          onSelectRoom(serverData[0].id);
        }
      } else {
        console.error('Failed to fetch rooms:', response.statusText);
        setError('Failed to load chat rooms from server');
        
        // Fallback to just having general
        const generalOnly = [{
          id: 'general',
          name: 'General',
          description: 'Public chat room for everyone'
        }];
        setRooms(generalOnly);
        onSelectRoom('general');
      }
    } catch (error) {
      console.error('Error fetching rooms:', error);
      setError('Error connecting to server');
      
      // Last-resort fallback
      const generalOnly = [{
        id: 'general',
        name: 'General',
        description: 'Public chat room for everyone'
      }];
      setRooms(generalOnly);
      
      if (!selectedRoom) {
        onSelectRoom('general');
      }
    } finally {
      setIsLoading(false);
    }
  }, [apiUrl, onSelectRoom, selectedRoom]);

  // Initial load on component mount and when refresh is triggered
  useEffect(() => {
    fetchRooms();
  }, [fetchRooms, refreshTrigger]);

  const handleAddChannel = async (channelName: string, channelDescription: string) => {
    try {
      // Create URL-friendly ID from name
      const channelId = channelName.toLowerCase().replace(/\s+/g, '-');
      
      // Check if channel already exists
      const channelExists = rooms.some(room => room.id === channelId);
      if (channelExists) {
        throw new Error('A channel with this name already exists');
      }
      
      // Create the new channel object
      const newChannel = {
        id: channelId,
        name: channelName,
        description: channelDescription || `${channelName} chat room`
      };
      
      // Add the new channel and sort properly
      const updatedRooms = [...rooms, newChannel].sort((a, b) => {
        if (a.id === 'general') return -1;
        if (b.id === 'general') return 1;
        return a.name.localeCompare(b.name);
      });
      
      // Update local state with sorted rooms (optimistic update)
      setRooms(updatedRooms);
      
      // Switch to the new room immediately
      onSelectRoom(channelId);
      
      // Then persist to backend
      const response = await fetch(`${apiUrl}/api/rooms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newChannel),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.warn('Error saving channel to server:', errorData.detail || response.statusText);
        setError('Error saving channel to server');
        setTimeout(() => setError(null), 5000);
        
        // Refresh channels to ensure we're in sync with the server
        fetchRooms();
      } else {
        console.log('Channel created successfully on server');
        const savedChannel = await response.json();
        
        // Refresh the channel list to ensure server and client are in sync
        // This is especially important if the server modified any properties
        fetchRooms();
      }
    } catch (error) {
      console.error('Error creating channel:', error);
      setError(error instanceof Error ? error.message : 'Unknown error creating channel');
      setTimeout(() => setError(null), 5000);
    }
  };

  const handleDeleteChannel = async (channelId: string) => {
    try {
      // Don't allow deletion of general channel
      if (channelId === 'general') {
        setError('The general channel cannot be deleted');
        setTimeout(() => setError(null), 5000);
        return;
      }
      
      // Delete the channel on the backend
      const response = await fetch(`${apiUrl}/api/rooms/${channelId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.warn('Error deleting channel on server:', errorData.detail || response.statusText);
        throw new Error(errorData.detail || 'Error deleting channel');
      }
      
      console.log('Channel deleted successfully on server');
      
      // Update local state (remove the deleted channel)
      const updatedRooms = rooms.filter(room => room.id !== channelId);
      setRooms(updatedRooms);
      
      // If the deleted channel was the selected one, switch to general
      if (selectedRoom === channelId) {
        onSelectRoom('general');
      }
      
      // Refresh the channel list to ensure server and client are in sync
      fetchRooms();
    } catch (error) {
      console.error('Error deleting channel:', error);
      setError(error instanceof Error ? error.message : 'Unknown error deleting channel');
      setTimeout(() => setError(null), 5000);
      throw error; // Re-throw to let the modal handle the error
    }
  };

  // Open delete confirmation modal
  const openDeleteModal = (room: ChatRoomData, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent channel selection when clicking delete
    setChannelToDelete(room);
    setIsDeleteChannelModalOpen(true);
  };

  // Refreshes the channel list from the server
  const handleRefreshChannels = useCallback(() => {
    console.log('Refreshing channels list from server...');
    setRefreshTrigger(prev => prev + 1); // This will trigger the useEffect
  }, []);

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h2>Chat Rooms</h2>
        <div className="sidebar-actions">
          <button
            className="refresh-button"
            onClick={handleRefreshChannels}
            title="Refresh Channels"
          >
            ↻
          </button>
          <button 
            className="add-channel-button" 
            onClick={() => setIsAddChannelModalOpen(true)}
          >
            + Add Channel
          </button>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}
      
      {isLoading && rooms.length === 0 ? (
        <div className="loading-indicator">Loading rooms...</div>
      ) : (
        <ul className="channel-list">
          {rooms.map((room) => (
            <li
              key={room.id}
              className={room.id === selectedRoom ? 'active' : ''}
              onClick={() => onSelectRoom(room.id)}
            >
              <div className="channel-item">
                <span className="channel-name"># {room.name || room.id}</span>
                {room.id !== 'general' && (
                  <button
                    className="delete-channel-button"
                    onClick={(e) => openDeleteModal(room, e)}
                    title={`Delete ${room.name} channel`}
                  >
                    ×
                  </button>
                )}
              </div>
            </li>
          ))}
          {rooms.length === 0 && !error && (
            <li className="no-channels">No channels available</li>
          )}
        </ul>
      )}
      
      <div className="active-users">
        <h3>Active Users ({activeUsers.length})</h3>
        <ul>
          {activeUsers.map((user) => (
            <li key={user}>{user}</li>
          ))}
          {activeUsers.length === 0 && (
            <li className="no-users">No active users</li>
          )}
        </ul>
      </div>

      <AddChannelModal
        isOpen={isAddChannelModalOpen}
        onClose={() => setIsAddChannelModalOpen(false)}
        onAddChannel={handleAddChannel}
      />

      {channelToDelete && (
        <DeleteChannelModal
          isOpen={isDeleteChannelModalOpen}
          onClose={() => setIsDeleteChannelModalOpen(false)}
          onDeleteChannel={handleDeleteChannel}
          channelId={channelToDelete.id}
          channelName={channelToDelete.name}
        />
      )}
    </div>
  );
};

export default Sidebar;