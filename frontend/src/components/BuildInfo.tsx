import { useState, useEffect } from 'react';
import './BuildInfo.css';

interface BuildInfoProps {
  backendUrl: string;
  isOpen: boolean;
  onClose: () => void;
}

interface VersionInfo {
  frontendBuildDate?: string;
  frontendVersion?: string;
  backendBuildDate?: string;
  backendVersion?: string;
  backendTimestamp?: string;
  isLoading: boolean;
  error?: string;
}

const BuildInfo: React.FC<BuildInfoProps> = ({ backendUrl, isOpen, onClose }) => {
  const [versionInfo, setVersionInfo] = useState<VersionInfo>({
    isLoading: true
  });

  useEffect(() => {
    const fetchVersionInfo = async () => {
      if (!isOpen) return;
      
      setVersionInfo(prev => ({ ...prev, isLoading: true, error: undefined }));
      
      try {
        // Try to load frontend build info
        const frontendInfo: Record<string, string> = {};
        
        try {
          // First check if we have window.BUILD_INFO
          const windowBuildInfo = (window as any).BUILD_INFO;
          if (windowBuildInfo) {
            frontendInfo.buildDate = windowBuildInfo.buildDate;
            frontendInfo.version = windowBuildInfo.version;
          } else {
            // Try to fetch from build-info.json
            const response = await fetch('/build-info.json');
            if (response.ok) {
              const data = await response.json();
              frontendInfo.buildDate = data.build_date;
              frontendInfo.version = data.version;
            }
          }
        } catch (e) {
          console.error('Error fetching frontend build info:', e);
        }
        
        // Fetch backend version info
        const backendResponse = await fetch(`${backendUrl}/api/version`);
        const backendData = await backendResponse.json();
        
        setVersionInfo({
          frontendBuildDate: frontendInfo.buildDate,
          frontendVersion: frontendInfo.version,
          backendBuildDate: backendData["Build date"],
          backendVersion: backendData["Image version"],
          backendTimestamp: backendData.timestamp,
          isLoading: false
        });
      } catch (error) {
        console.error('Error fetching version info:', error);
        setVersionInfo(prev => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Failed to fetch version info'
        }));
      }
    };

    fetchVersionInfo();
  }, [isOpen, backendUrl]);

  if (!isOpen) return null;

  // Close if clicking outside the modal content
  const handleOutsideClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="modal-overlay" onClick={handleOutsideClick}>
      <div className="modal-content version-info-modal">
        <div className="modal-header">
          <h3>Deployment Information</h3>
          <button className="close-button" onClick={onClose}>&times;</button>
        </div>
        
        <div className="modal-body">
          {versionInfo.isLoading && <p className="loading-message">Loading version information...</p>}
          
          {versionInfo.error && (
            <p className="error-message">Error: {versionInfo.error}</p>
          )}
          
          {!versionInfo.isLoading && !versionInfo.error && (
            <table className="build-info-table">
              <thead>
                <tr>
                  <th></th>
                  <th>Frontend</th>
                  <th>Backend</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Build Date</td>
                  <td>{versionInfo.frontendBuildDate || 'Not available'}</td>
                  <td>{versionInfo.backendBuildDate || 'Not available'}</td>
                </tr>
                <tr>
                  <td>Version</td>
                  <td>{versionInfo.frontendVersion || 'Not available'}</td>
                  <td>{versionInfo.backendVersion || 'Not available'}</td>
                </tr>
                <tr>
                  <td>Current Time</td>
                  <td colSpan={2}>{new Date().toISOString()}</td>
                </tr>
                {versionInfo.backendTimestamp && (
                  <tr>
                    <td>Backend Time</td>
                    <td colSpan={2}>{versionInfo.backendTimestamp}</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default BuildInfo;