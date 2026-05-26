// Socket.IO Frontend Client Example
// Add this to your React/Frontend component
import { useEffect, useState } from 'react';
import io from 'socket.io-client';
const SOCKET_SERVER = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5001';
export const useSocketIO = () => {
    const [socket, setSocket] = useState(null);
    const [isConnected, setIsConnected] = useState(false);
    const [mwdData, setMwdData] = useState([]);
    const [gatewayStatus, setGatewayStatus] = useState(null);
    const [connectionStatus, setConnectionStatus] = useState(null);
    const [witsData, setWitsData] = useState(null);
    const [alerts, setAlerts] = useState([]);
    useEffect(() => {
        const socketInstance = io(SOCKET_SERVER, {
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            reconnectionAttempts: 5,
        });
        // Connection events
        socketInstance.on('connect', () => {
            console.log('Socket.IO connected:', socketInstance.id);
            setIsConnected(true);
        });
        socketInstance.on('disconnect', () => {
            console.log('Socket.IO disconnected');
            setIsConnected(false);
        });
        socketInstance.on('connected', (data) => {
            console.log('Welcome message from server:', data);
        });
        // MWD Data events
        socketInstance.on('mwd-data', (data) => {
            console.log('MWD Data received:', data);
            setMwdData((prev) => {
                // Keep only last 100 items
                const updated = [data, ...prev].slice(0, 100);
                return updated;
            });
        });
        // Gateway Status events
        socketInstance.on('esp-gateway-status', (status) => {
            console.log('ESP Gateway Status:', status);
            setGatewayStatus(status);
        });
        // Connection Status events
        socketInstance.on('connection-status', (status) => {
            console.log('Connection Status:', status);
            setConnectionStatus(status);
        });
        // WITS Data events
        socketInstance.on('wits-data', (data) => {
            console.log('WITS Data received:', data);
            setWitsData(data);
        });
        // Alert events
        socketInstance.on('alert', (alert) => {
            console.log('Alert received:', alert);
            setAlerts((prev) => [alert, ...prev].slice(0, 50));
        });
        // Error events
        socketInstance.on('error', (error) => {
            console.error('Error from server:', error);
        });
        setSocket(socketInstance);
        return () => {
            socketInstance.disconnect();
        };
    }, []);
    const requestLatestData = (callback) => {
        if (socket) {
            socket.emit('request-latest-data', callback);
        }
    };
    const ping = (callback) => {
        if (socket) {
            socket.emit('ping', callback);
        }
    };
    return {
        socket,
        isConnected,
        mwdData,
        gatewayStatus,
        connectionStatus,
        witsData,
        alerts,
        requestLatestData,
        ping,
    };
};
// Example Component Usage:
// 
// function DashboardComponent() {
//   const { isConnected, mwdData, gatewayStatus, alerts } = useSocketIO();
//
//   return (
//     <div>
//       <p>Connection Status: {isConnected ? '✓ Connected' : '✗ Disconnected'}</p>
//       <p>Latest MWD Data: {mwdData.length} records</p>
//       {gatewayStatus && (
//         <div>
//           <p>Gateway: {gatewayStatus.connected ? 'Connected' : 'Disconnected'}</p>
//           <p>Signal Quality: {gatewayStatus.signal?.quality}</p>
//         </div>
//       )}
//       <div>
//         <h3>Recent Alerts ({alerts.length})</h3>
//         {alerts.map((alert) => (
//           <div key={alert.timestamp}>{alert.message}</div>
//         ))}
//       </div>
//     </div>
//   );
// }
//# sourceMappingURL=SOCKET_IO_CLIENT_EXAMPLE.js.map