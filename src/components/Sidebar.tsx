import Link from 'next/link';
import React from 'react';

export default function Sidebar() {
  return (
    <aside className="w-64 bg-gray-800 text-white flex-shrink-0 overflow-y-auto">
      <div className="p-4">
        {/* Logo or App Name */}
        <div className="text-2xl font-bold mb-6">DHM Portal</div>

        {/* Navigation Links */}
        <nav>
          <ul>
            <li className="mb-2">
              <Link href="/" className="block py-2 px-4 rounded hover:bg-gray-700">
                Home
              </Link>
            </li>
            <li className="mb-2">
              <Link href="/your-dashboard" className="block py-2 px-4 rounded hover:bg-gray-700">
                Your dashboard
              </Link>
            </li>
            <li className="mb-2">
              <Link href="/team-dashboard" className="block py-2 px-4 rounded hover:bg-gray-700">
                Team dashboard
              </Link>
            </li>
            <li className="mb-2">
              <Link href="/profile" className="block py-2 px-4 rounded hover:bg-gray-700">
                Your Profile
              </Link>
            </li>
            <li className="mb-2">
              <Link href="/company" className="block py-2 px-4 rounded hover:bg-gray-700">
                Company
              </Link>
            </li>
            <li className="mb-2">
              <Link href="/meetings" className="block py-2 px-4 rounded hover:bg-gray-700">
                Meetings
              </Link>
            </li>
            {/* Add other links as needed */}
            {/* Placeholder for other sections like Meetings, Instant Feedback, Goals, Reviews, Surveys, Learning, Compensation, Analytics, Settings, Log Out */}
            <li className="mb-2">
              <Link href="/instant-feedback" className="block py-2 px-4 rounded hover:bg-gray-700">
                Instant Feedback
              </Link>
            </li>
            <li className="mb-2">
              <Link href="/goals" className="block py-2 px-4 rounded hover:bg-gray-700">
                Goals
              </Link>
            </li>
            <li className="mb-2">
              <Link href="/reviews" className="block py-2 px-4 rounded hover:bg-gray-700">
                Reviews
              </Link>
            </li>
            <li className="mb-2">
              <Link href="/surveys" className="block py-2 px-4 rounded hover:bg-gray-700">
                Surveys
              </Link>
            </li>
            <li className="mb-2">
              <Link href="/learning" className="block py-2 px-4 rounded hover:bg-gray-700">
                Learning
              </Link>
            </li>
            <li className="mb-2">
              <Link href="/compensation" className="block py-2 px-4 rounded hover:bg-gray-700">
                Compensation
              </Link>
            </li>
            <li className="mb-2">
              <Link href="/analytics" className="block py-2 px-4 rounded hover:bg-gray-700">
                Analytics
              </Link>
            </li>
            <li className="mb-2">
              <Link href="/settings" className="block py-2 px-4 rounded hover:bg-gray-700">
                Settings
              </Link>
            </li>
            <li className="mb-2">
              <Link href="/logout" className="block py-2 px-4 rounded hover:bg-gray-700">
                Log Out
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </aside>
  );
}
