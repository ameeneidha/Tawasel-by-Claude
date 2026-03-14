import { io } from "socket.io-client";
import { SOCKET_URL } from "./runtime-config";

const socket = io(SOCKET_URL || window.location.origin, {
  autoConnect: false,
});

export default socket;
