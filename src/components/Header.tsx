import React from 'react';

export default function Header() {
  return (
    <header className="bg-white shadow p-4 flex-shrink-0 flex items-center justify-between">
      {/* Search Bar Placeholder */}
      <div className="flex-grow max-w-md mr-4">
        {/* You can add an input element here later */}
        <input
          type="text"
          placeholder="Search for users, reviews, goals and meetings"
          className="w-full px-4 py-2 rounded border focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Right section: Create, Your team, User Profile */}
      <div className="flex items-center space-x-4">
        <button className="flex items-center px-3 py-2 border rounded text-gray-700 hover:bg-gray-100">
          {/* Placeholder Icon */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5 mr-1"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 6v6m0 0v6m0-6h6m-6 0H6"
            />
          </svg>
          Create
        </button>
        <button className="flex items-center px-3 py-2 border rounded text-gray-700 hover:bg-gray-100">
          {/* Placeholder Icon */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5 mr-1"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
            />
          </svg>
          Your team
        </button>
        {/* User Profile/Avatar Placeholder */}
        <div className="flex items-center space-x-2">
          {/* Placeholder Avatar */}
          <div className="w-8 h-8 rounded-full bg-gray-300"></div>
          <span className="text-gray-700">Leslie Leapsome</span> {/* Placeholder Name */}
        </div>
      </div>
    </header>
  );
}
