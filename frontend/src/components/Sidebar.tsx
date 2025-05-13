import React, { useEffect, useState, useCallback } from 'react';
import './Sidebar.css';
import { useChat } from '../contexts/ChatContext';
import AddChannelModal from './AddChannelModal';
import DeleteChannelModal from './DeleteChannelModal';
import { getApiBaseUrl } from '../utils/apiUrls';

interface SidebarProps {
  selectedRoom: string; // Prop passed from App.tsx
  onSelectRoom: (roomId: string) => void; // Callback to update App.tsx's selectedRoom state
}

interface ChatRoomData {
  id: string;
  name: string;
  description: string;
}

const Sidebar: React.FC<SidebarProps> = ({ selectedRoom, onSelectRoom }) => {
  const {
    currentRoomId,
    setCurrentRoomId,
    unreadMessages,
    activeUsersByRoom
  } = useChat();
  const [rooms, setRooms] = useState<ChatRoomData[]>([]);
  const [isAddChannelModalOpen, setIsAddChannelModalOpen] = useState(false);
  const [isDeleteChannelModalOpen, setIsDeleteChannelModalOpen] = useState(false);
  const [channelToDelete, setChannelToDelete] = useState<ChatRoomData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const apiUrl = getApiBaseUrl();

  const fetchRooms = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${apiUrl}/api/rooms`);
      if (response.ok) {
        const serverData = await response.json();
        if (!serverData.some((room: ChatRoomData) => room.id === 'general')) {
          serverData.push({
            id: 'general',
            name: 'General',
            description: 'Public chat room for everyone'
          });
        }
        serverData.sort((a: ChatRoomData, b: ChatRoomData) => {
          if (a.id === 'general') return -1;
          if (b.id === 'general') return 1;
          return a.name.localeCompare(b.name);
        });
        setRooms(serverData);
        if (!currentRoomId && serverData.length > 0) {
          setCurrentRoomId(serverData[0].id);
        }
      } else {
        console.error('Failed to fetch rooms:', response.statusText);
        setError('Failed to load chat rooms from server');
        const generalOnly = [{ id: 'general', name: 'General', description: 'Public chat room for everyone' }];
        setRooms(generalOnly);
        if (!currentRoomId) setCurrentRoomId('general');
      }
    } catch (error) {
      console.error('Error fetching rooms:', error);
      setError('Error connecting to server');
      const generalOnly = [{ id: 'general', name: 'General', description: 'Public chat room for everyone' }];
      setRooms(generalOnly);
      if (!currentRoomId) setCurrentRoomId('general');
    } finally {
      setIsLoading(false);
    }
  }, [apiUrl, setCurrentRoomId, currentRoomId]);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms, refreshTrigger]);

  const handleSelectRoom = (roomId: string) => {
    setCurrentRoomId(roomId); // Update context's currentRoomId
    onSelectRoom(roomId);     // Update App.tsx's selectedRoom state
  };

  const handleAddChannel = async (channelName: string, channelDescription: string) => {
    try {
      const channelId = channelName.toLowerCase().replace(/\s+/g, '-');
      if (rooms.some(room => room.id === channelId)) {
        throw new Error('A channel with this name already exists');
      }
      const newChannel = { id: channelId, name: channelName, description: channelDescription || `${channelName} chat room` };
      
      const updatedRooms = [...rooms, newChannel].sort((a, b) => {
        if (a.id === 'general') return -1;
        if (b.id === 'general') return 1;
        return a.name.localeCompare(b.name);
      });
      setRooms(updatedRooms);
      setCurrentRoomId(channelId);

      const response = await fetch(`${apiUrl}/api/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newChannel),
      });
      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.detail || 'Error saving channel to server');
        setTimeout(() => setError(null), 5000);
        fetchRooms();
      } else {
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
      if (channelId === 'general') {
        setError('The general channel cannot be deleted');
        setTimeout(() => setError(null), 5000);
        return;
      }
      const response = await fetch(`${apiUrl}/api/rooms/${channelId}`, { method: 'DELETE' });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Error deleting channel');
      }
      const updatedRooms = rooms.filter(room => room.id !== channelId);
      setRooms(updatedRooms);
      if (currentRoomId === channelId) {
        setCurrentRoomId('general');
      }
      fetchRooms();
    } catch (error) {
      console.error('Error deleting channel:', error);
      setError(error instanceof Error ? error.message : 'Unknown error deleting channel');
      setTimeout(() => setError(null), 5000);
      throw error;
    }
  };

  const openDeleteModal = (room: ChatRoomData, e: React.MouseEvent) => {
    e.stopPropagation();
    setChannelToDelete(room);
    setIsDeleteChannelModalOpen(true);
  };

  const handleRefreshChannels = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
  }, []);

  // Get all active users across all channels (without duplicates)
  const allActiveUsers = React.useMemo(() => {
    // Create a map using user ids as keys to ensure uniqueness
    const uniqueUsersMap = new Map();
    
    // Iterate through all rooms and their active users
    Object.values(activeUsersByRoom).forEach(roomUsers => {
      roomUsers.forEach((user) => {
        // Only add the user if they're not already in our map
        if (!uniqueUsersMap.has(user.id)) {
          uniqueUsersMap.set(user.id, user);
        }
      });
    });
    
    // Convert the map values back to an array
    return Array.from(uniqueUsersMap.values());
  }, [activeUsersByRoom]);

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
          {rooms.map((room) => {
            const unreadCount = unreadMessages[room.id] || 0;
            const hasUnread = unreadCount > 0 && room.id !== currentRoomId;

            return (
              <li
                key={room.id}
                className={`${room.id === currentRoomId ? 'active' : ''}`}
                onClick={() => handleSelectRoom(room.id)}
                title={room.name || room.id}
              >
                <div className="channel-item">
                  <div className="channel-label">
                    <span className="channel-hash">#</span>{room.name || room.id}
                  </div>
                  <div className="channel-actions">
                    {hasUnread && (
                      <span className="unread-indicator">{unreadCount > 9 ? '9+' : unreadCount}</span>
                    )}
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
                </div>
              </li>
            );
          })}
          {rooms.length === 0 && !error && (
            <li className="no-channels">No channels available</li>
          )}
        </ul>
      )}
      
      <div className="active-users">
        <h3>Active Users ({allActiveUsers.length})</h3>
        <ul>
          {allActiveUsers.map((user) => (
            <li key={user.id} title={`User ID: ${user.id}`}>
              {user.username}
            </li>
          ))}
          {allActiveUsers.length === 0 && (
            <li className="no-users">No active users online</li>
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