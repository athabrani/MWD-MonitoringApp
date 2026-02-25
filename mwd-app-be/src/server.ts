import express from "express";

const app = express();
const PORT =  5001; 

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

app.get("/", (req, res) => {
    res.send("Hello from the server!");
})

//http:/localhost:5001