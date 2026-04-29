import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import ChannelList from "./pages/ChannelList";
import ChannelDetail from "./pages/ChannelDetail";
import ChannelCreate from "./pages/ChannelCreate";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/admin" element={<ChannelList />} />
        <Route path="/admin/channel/:channelId" element={<ChannelDetail />} />
        <Route path="/admin/create" element={<ChannelCreate />} />
        <Route path="/" element={<Navigate to="/admin" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
