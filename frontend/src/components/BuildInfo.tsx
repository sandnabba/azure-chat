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
  backendError?: string;
}

const BuildInfo: React.FC<BuildInfoProps> = ({ backendUrl, isOpen, onClose }) => {
  const [versionInfo, setVersionInfo] = useState<VersionInfo>({
    isLoading: true
  });

  useEffect(() => {
    const fetchVersionInfo = async () => {
      if (!isOpen) return;
      
      setVersionInfo(prev => ({ ...prev, isLoading: true, backendError: undefined }));
      
      try {
        // Initialize with empty info objects
        const frontendInfo: Record<string, string> = {};
        let backendInfo: Record<string, any> = {};
        let backendError: string | undefined = undefined;
        
        // Try to load frontend build info
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
          // Still continue even if frontend info fetch fails
        }
        
        // Try to fetch backend version info - wrapped in a separate try/catch
        try {
          const backendResponse = await fetch(`${backendUrl}/api/version`, {
            // Add a timeout to prevent long waiting when backend is down
            signal: AbortSignal.timeout(5000) // 5 second timeout
          });
          
          if (backendResponse.ok) {
            backendInfo = await backendResponse.json();
          } else {
            backendError = `Backend returned ${backendResponse.status} ${backendResponse.statusText}`;
          }
        } catch (e) {
          console.error('Error fetching backend build info:', e);
          backendError = e instanceof Error 
            ? e.message 
            : 'Failed to connect to backend service';
        }
        
        // Update state with all available information, even if partial
        setVersionInfo({
          frontendBuildDate: frontendInfo.buildDate,
          frontendVersion: frontendInfo.version,
          backendBuildDate: backendInfo["Build date"],
          backendVersion: backendInfo["Image version"],
          backendTimestamp: backendInfo.timestamp,
          backendError: backendError,
          isLoading: false
        });
      } catch (error) {
        console.error('Unexpected error fetching version info:', error);
        // Even with an overall error, try to display any frontend info we have
        setVersionInfo(prev => ({
          ...prev,
          isLoading: false,
          backendError: error instanceof Error ? error.message : 'Failed to fetch version info'
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
          
          {!versionInfo.isLoading && (
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
                  <td>{versionInfo.backendBuildDate || (versionInfo.backendError ? 'Unavailable' : 'Not available')}</td>
                </tr>
                <tr>
                  <td>Version</td>
                  <td>{versionInfo.frontendVersion || 'Not available'}</td>
                  <td>{versionInfo.backendVersion || (versionInfo.backendError ? 'Unavailable' : 'Not available')}</td>
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
                {versionInfo.backendError && (
                  <tr className="error-row">
                    <td>Backend Status</td>
                    <td colSpan={2} className="error-message">
                      Error: {versionInfo.backendError}
                    </td>
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