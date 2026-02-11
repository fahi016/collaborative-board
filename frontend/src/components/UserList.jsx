// src/components/UserList.jsx
function UserList({ users, currentUser }) {
  return (
    <div className="flex items-center space-x-2">
      <span className="text-sm text-gray-600">Online:</span>
      <div className="flex items-center space-x-2">
        {users.map((user, index) => (
          <div
            key={user.sessionId || index}
            className="flex items-center space-x-1 px-3 py-1 bg-gray-100 rounded-full"
          >
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: user.color || '#888' }}
            />
            <span className="text-sm font-medium text-gray-700">
              {user.userName}
              {user.userName === currentUser && ' (You)'}
            </span>
          </div>
        ))}
      </div>
      <span className="text-sm text-gray-500">
        ({users.length}/3)
      </span>
    </div>
  );
}

export default UserList;