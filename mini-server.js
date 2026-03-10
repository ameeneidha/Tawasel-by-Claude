import http from "http";
http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("MINIMAL JS SERVER RUNNING ON PORT 3000");
}).listen(3000, "0.0.0.0", () => {
  console.log("Minimal server listening on port 3000");
});
