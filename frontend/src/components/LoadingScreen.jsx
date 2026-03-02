import { FourSquare } from 'react-loading-indicators';

function LoadingScreen() {
  return (
    <div className="loading-screen">
      <div className="loading-shell">
        <FourSquare color="#c6d7c6" size="medium" text="" textColor="" />
      </div>
    </div>
  );
}

export default LoadingScreen;
