const express = require('express')
var cors = require('cors')
const app = express()
require('dotenv').config()

// middleware
app.use(cors())
app.use(express.json())

const port = process.env.PORT || 5000;

app.get('/', (req, res) => {
  res.send('doctors portal is running ')
})

app.listen(port, () => {
  console.log(`doctors portals app listening on port ${port}`)
})