class PivexExplorer {
  constructor() {
    // GANTI dengan IP VPS kamu!
    this.rpcUrl = "http://188.166.247.52:8545"
    this.currentPage = 1
    this.itemsPerPage = 25
    this.latestBlockNumber = 0
    this.currentAddress = null
    this.currentTxHash = null
    this.currentBlockNumber = null

    this.init()
  }

  init() {
    this.setupEventListeners()
    this.setupRouting()
    this.loadInitialData()
    this.startAutoRefresh()
  }

  setupEventListeners() {
    // Search functionality
    document.getElementById("searchInput").addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        this.performSearch()
      }
    })

    // Contract verification form
    document.getElementById("verifyForm").addEventListener("submit", (e) => {
      e.preventDefault()
      this.verifyContract()
    })

    // Handle browser back/forward
    window.addEventListener("popstate", () => {
      this.handleRoute()
    })
  }

  setupRouting() {
    // Handle initial route
    this.handleRoute()
  }

  handleRoute() {
    const path = window.location.pathname
    const segments = path.split("/").filter((s) => s)

    // Hide all pages
    document.querySelectorAll(".page").forEach((page) => {
      page.classList.remove("active")
    })

    if (segments.length === 0) {
      // Home page
      document.getElementById("home-page").classList.add("active")
    } else if (segments[0] === "address" && segments[1]) {
      // Address page
      this.currentAddress = segments[1]
      document.getElementById("address-page").classList.add("active")
      this.loadAddressDetails(segments[1])
    } else if (segments[0] === "tx" && segments[1]) {
      // Transaction page
      this.currentTxHash = segments[1]
      document.getElementById("transaction-page").classList.add("active")
      this.loadTransactionDetails(segments[1])
    } else if (segments[0] === "block" && segments[1]) {
      // Block page
      this.currentBlockNumber = Number.parseInt(segments[1])
      document.getElementById("block-page").classList.add("active")
      this.loadBlockDetails(Number.parseInt(segments[1]))
    } else {
      // Default to home
      document.getElementById("home-page").classList.add("active")
    }
  }

  navigateTo(path) {
    window.history.pushState({}, "", path)
    this.handleRoute()
  }

  async rpcCall(method, params = []) {
    try {
      const response = await fetch(this.rpcUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: method,
          params: params,
          id: 1,
        }),
      })

      const data = await response.json()
      if (data.error) {
        throw new Error(data.error.message)
      }
      return data.result
    } catch (error) {
      console.error("RPC Error:", error)
      return null
    }
  }

  async loadInitialData() {
    await this.loadNetworkStats()
    await this.loadLatestBlocks()
    await this.loadLatestTransactions()
  }

  async loadNetworkStats() {
    try {
      const latestBlock = await this.rpcCall("eth_blockNumber")
      this.latestBlockNumber = Number.parseInt(latestBlock, 16)

      document.getElementById("latestBlock").textContent = this.latestBlockNumber.toLocaleString()
      document.getElementById("totalTxs").textContent = (this.latestBlockNumber * 2).toLocaleString()
    } catch (error) {
      console.error("Error loading network stats:", error)
    }
  }

  async loadLatestBlocks() {
    const tbody = document.getElementById("latestBlocksTable")
    tbody.innerHTML = '<tr><td colspan="4" class="loading">Loading blocks...</td></tr>'

    try {
      let blocksHtml = ""
      for (let i = 0; i < 10; i++) {
        const blockNumber = this.latestBlockNumber - i
        const block = await this.rpcCall("eth_getBlockByNumber", [`0x${blockNumber.toString(16)}`, true])

        if (block) {
          const timestamp = Number.parseInt(block.timestamp, 16)
          const age = this.getTimeAgo(timestamp)
          const txCount = block.transactions ? block.transactions.length : 0
          const gasUsed = Number.parseInt(block.gasUsed, 16)
          const gasLimit = Number.parseInt(block.gasLimit, 16)
          const gasPercent = ((gasUsed / gasLimit) * 100).toFixed(1)

          blocksHtml += `
                        <tr>
                            <td>
                                <a href="/block/${blockNumber}" class="clickable" onclick="explorer.navigateTo('/block/${blockNumber}'); return false;">
                                    ${blockNumber}
                                </a>
                            </td>
                            <td>${age}</td>
                            <td>${txCount}</td>
                            <td>${gasUsed.toLocaleString()} (${gasPercent}%)</td>
                        </tr>
                    `
        }
      }
      tbody.innerHTML = blocksHtml || '<tr><td colspan="4" class="no-data">No blocks found</td></tr>'
    } catch (error) {
      tbody.innerHTML = '<tr><td colspan="4" class="no-data">Error loading blocks</td></tr>'
    }
  }

  async loadLatestTransactions() {
    const tbody = document.getElementById("latestTxsTable")
    tbody.innerHTML = '<tr><td colspan="4" class="loading">Loading transactions...</td></tr>'

    try {
      let txsHtml = ""
      let txCount = 0

      for (let i = 0; i < 5 && txCount < 10; i++) {
        const blockNumber = this.latestBlockNumber - i
        const block = await this.rpcCall("eth_getBlockByNumber", [`0x${blockNumber.toString(16)}`, true])

        if (block && block.transactions) {
          for (const tx of block.transactions.slice(0, 5)) {
            if (txCount >= 10) break

            const value = Number.parseInt(tx.value, 16) / Math.pow(10, 18)

            txsHtml += `
                            <tr>
                                <td>
                                    <a href="/tx/${tx.hash}" class="clickable hash" onclick="explorer.navigateTo('/tx/${tx.hash}'); return false;">
                                        ${this.truncateHash(tx.hash)}
                                    </a>
                                </td>
                                <td>
                                    <a href="/address/${tx.from}" class="address" onclick="explorer.navigateTo('/address/${tx.from}'); return false;">
                                        ${this.truncateHash(tx.from)}
                                    </a>
                                </td>
                                <td>
                                    ${tx.to ? `<a href="/address/${tx.to}" class="address" onclick="explorer.navigateTo('/address/${tx.to}'); return false;">${this.truncateHash(tx.to)}</a>` : "Contract Creation"}
                                </td>
                                <td>${value.toFixed(4)} ETH</td>
                            </tr>
                        `
            txCount++
          }
        }
      }
      tbody.innerHTML = txsHtml || '<tr><td colspan="4" class="no-data">No transactions found</td></tr>'
    } catch (error) {
      tbody.innerHTML = '<tr><td colspan="4" class="no-data">Error loading transactions</td></tr>'
    }
  }

  async loadAddressDetails(address) {
    // Set address in header
    document.getElementById("addressValue").textContent = address

    try {
      // Load basic address info
      const balance = await this.rpcCall("eth_getBalance", [address, "latest"])
      const txCount = await this.rpcCall("eth_getTransactionCount", [address, "latest"])
      const code = await this.rpcCall("eth_getCode", [address, "latest"])

      const balanceEth = Number.parseInt(balance, 16) / Math.pow(10, 18)
      const isContract = code && code !== "0x"

      // Update overview
      document.getElementById("addressBalance").textContent = `${balanceEth.toFixed(6)} ETH`
      document.getElementById("addressTxCount").textContent = Number.parseInt(txCount, 16).toLocaleString()
      document.getElementById("addressType").textContent = isContract ? "Contract" : "EOA"

      // Show/hide contract tab
      if (isContract) {
        document.getElementById("contractTab").style.display = "block"
        await this.loadContractInfo(address, code)
      } else {
        document.getElementById("contractTab").style.display = "none"
      }

      // Load address transactions
      await this.loadAddressTransactions(address)
    } catch (error) {
      console.error("Error loading address details:", error)
    }
  }

  async loadAddressTransactions(address) {
    const tbody = document.getElementById("addressTxsTable")
    tbody.innerHTML = '<tr><td colspan="7" class="loading">Loading transactions...</td></tr>'

    try {
      let txsHtml = ""
      let foundTxs = 0

      // Search through recent blocks for transactions involving this address
      for (let i = 0; i < 100 && foundTxs < 25; i++) {
        const blockNumber = this.latestBlockNumber - i
        if (blockNumber < 0) break

        const block = await this.rpcCall("eth_getBlockByNumber", [`0x${blockNumber.toString(16)}`, true])

        if (block && block.transactions) {
          for (const tx of block.transactions) {
            if (
              tx.from.toLowerCase() === address.toLowerCase() ||
              (tx.to && tx.to.toLowerCase() === address.toLowerCase())
            ) {
              const value = Number.parseInt(tx.value, 16) / Math.pow(10, 18)
              const timestamp = Number.parseInt(block.timestamp, 16)
              const age = this.getTimeAgo(timestamp)

              // Get transaction receipt for gas info
              const receipt = await this.rpcCall("eth_getTransactionReceipt", [tx.hash])
              const gasUsed = receipt ? Number.parseInt(receipt.gasUsed, 16) : 0
              const gasPrice = Number.parseInt(tx.gasPrice, 16) / Math.pow(10, 9)
              const fee = (gasUsed * gasPrice) / Math.pow(10, 9)

              txsHtml += `
                                <tr>
                                    <td>
                                        <a href="/tx/${tx.hash}" class="clickable hash" onclick="explorer.navigateTo('/tx/${tx.hash}'); return false;">
                                            ${this.truncateHash(tx.hash)}
                                        </a>
                                    </td>
                                    <td>
                                        <a href="/block/${blockNumber}" class="clickable" onclick="explorer.navigateTo('/block/${blockNumber}'); return false;">
                                            ${blockNumber}
                                        </a>
                                    </td>
                                    <td>${age}</td>
                                    <td>
                                        <a href="/address/${tx.from}" class="address" onclick="explorer.navigateTo('/address/${tx.from}'); return false;">
                                            ${this.truncateHash(tx.from)}
                                        </a>
                                    </td>
                                    <td>
                                        ${tx.to ? `<a href="/address/${tx.to}" class="address" onclick="explorer.navigateTo('/address/${tx.to}'); return false;">${this.truncateHash(tx.to)}</a>` : "Contract Creation"}
                                    </td>
                                    <td>${value.toFixed(6)} ETH</td>
                                    <td>${fee.toFixed(6)} ETH</td>
                                </tr>
                            `
              foundTxs++

              if (foundTxs >= 25) break
            }
          }
        }
      }

      tbody.innerHTML = txsHtml || '<tr><td colspan="7" class="no-data">No transactions found</td></tr>'
    } catch (error) {
      tbody.innerHTML = '<tr><td colspan="7" class="no-data">Error loading transactions</td></tr>'
    }
  }

  async loadContractInfo(address, code) {
    // Try to detect contract type
    try {
      // Try ERC-20 name function
      const nameResult = await this.rpcCall("eth_call", [
        {
          to: address,
          data: "0x06fdde03", // name()
        },
        "latest",
      ])

      if (nameResult && nameResult !== "0x") {
        const name = this.hexToString(nameResult)
        document.getElementById("contractName").textContent = name || "ERC-20 Token"
        document.getElementById("tokensTab").style.display = "block"
      }
    } catch (e) {
      // Not an ERC-20 or error calling
    }

    // Set contract code
    document.getElementById("contractCode").textContent = code
  }

  async loadTransactionDetails(txHash) {
    document.getElementById("txHash").textContent = txHash

    try {
      const tx = await this.rpcCall("eth_getTransactionByHash", [txHash])
      const receipt = await this.rpcCall("eth_getTransactionReceipt", [txHash])

      if (!tx) {
        document.getElementById("txStatusText").textContent = "Transaction not found"
        return
      }

      // Get block for timestamp
      const block = await this.rpcCall("eth_getBlockByNumber", [tx.blockNumber, false])
      const timestamp = block ? Number.parseInt(block.timestamp, 16) : 0

      // Update transaction details
      const value = Number.parseInt(tx.value, 16) / Math.pow(10, 18)
      const gasPrice = Number.parseInt(tx.gasPrice, 16) / Math.pow(10, 9)
      const gasUsed = receipt ? Number.parseInt(receipt.gasUsed, 16) : 0
      const gasLimit = Number.parseInt(tx.gas, 16)
      const fee = (gasUsed * gasPrice) / Math.pow(10, 9)
      const status = receipt ? (receipt.status === "0x1" ? "Success" : "Failed") : "Pending"

      document.getElementById("txStatusText").textContent = status
      document.getElementById("statusBadge").textContent = status
      document.getElementById("statusBadge").className = `status-badge status-${status.toLowerCase()}`

      document.getElementById("txBlock").innerHTML =
        `<a href="/block/${Number.parseInt(tx.blockNumber, 16)}" class="clickable" onclick="explorer.navigateTo('/block/${Number.parseInt(tx.blockNumber, 16)}'); return false;">${Number.parseInt(tx.blockNumber, 16)}</a>`
      document.getElementById("txTimestamp").textContent = timestamp ? new Date(timestamp * 1000).toLocaleString() : "-"
      document.getElementById("txFrom").innerHTML =
        `<a href="/address/${tx.from}" class="address" onclick="explorer.navigateTo('/address/${tx.from}'); return false;">${tx.from}</a>`
      document.getElementById("txTo").innerHTML = tx.to
        ? `<a href="/address/${tx.to}" class="address" onclick="explorer.navigateTo('/address/${tx.to}'); return false;">${tx.to}</a>`
        : "Contract Creation"
      document.getElementById("txValue").textContent = `${value.toFixed(6)} ETH`
      document.getElementById("txFee").textContent = `${fee.toFixed(6)} ETH`
      document.getElementById("txGasPrice").textContent = `${gasPrice.toFixed(2)} Gwei`
      document.getElementById("txGasUsed").textContent = gasUsed.toLocaleString()
      document.getElementById("txGasLimit").textContent = gasLimit.toLocaleString()
      document.getElementById("txNonce").textContent = Number.parseInt(tx.nonce, 16)
      document.getElementById("txInputData").textContent = tx.input || "0x"

      // Show logs if available
      if (receipt && receipt.logs && receipt.logs.length > 0) {
        document.getElementById("logsTab").style.display = "block"
        this.displayTransactionLogs(receipt.logs)
      }
    } catch (error) {
      console.error("Error loading transaction details:", error)
      document.getElementById("txStatusText").textContent = "Error loading transaction"
    }
  }

  displayTransactionLogs(logs) {
    const logsContainer = document.getElementById("txLogs")
    let logsHtml = ""

    logs.forEach((log, index) => {
      logsHtml += `
                <div class="log-entry">
                    <h4>Log ${index}</h4>
                    <div class="log-details">
                        <div class="detail-row">
                            <span class="detail-label">Address:</span>
                            <span class="detail-value address">${log.address}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Topics:</span>
                            <div class="topics">
                                ${log.topics.map((topic) => `<div class="topic hash">${topic}</div>`).join("")}
                            </div>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Data:</span>
                            <span class="detail-value hash">${log.data}</span>
                        </div>
                    </div>
                </div>
            `
    })

    logsContainer.innerHTML = logsHtml
  }

  async loadBlockDetails(blockNumber) {
    document.getElementById("blockNumber").textContent = blockNumber
    document.getElementById("blockHeight").textContent = blockNumber

    try {
      const block = await this.rpcCall("eth_getBlockByNumber", [`0x${blockNumber.toString(16)}`, true])

      if (!block) {
        document.getElementById("blockTimestamp").textContent = "Block not found"
        return
      }

      const timestamp = Number.parseInt(block.timestamp, 16)
      const gasUsed = Number.parseInt(block.gasUsed, 16)
      const gasLimit = Number.parseInt(block.gasLimit, 16)
      const txCount = block.transactions ? block.transactions.length : 0

      document.getElementById("blockTimestamp").textContent = new Date(timestamp * 1000).toLocaleString()
      document.getElementById("blockTxCount").textContent = txCount
      document.getElementById("blockMiner").innerHTML =
        `<a href="/address/${block.miner}" class="address" onclick="explorer.navigateTo('/address/${block.miner}'); return false;">${block.miner}</a>`
      document.getElementById("blockGasUsed").textContent =
        `${gasUsed.toLocaleString()} (${((gasUsed / gasLimit) * 100).toFixed(2)}%)`
      document.getElementById("blockGasLimit").textContent = gasLimit.toLocaleString()
      document.getElementById("blockHash").textContent = block.hash
      document.getElementById("blockParentHash").textContent = block.parentHash

      // Load block transactions
      await this.loadBlockTransactions(block.transactions)
    } catch (error) {
      console.error("Error loading block details:", error)
    }
  }

  async loadBlockTransactions(transactions) {
    const tbody = document.getElementById("blockTxsTable")

    if (!transactions || transactions.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="no-data">No transactions in this block</td></tr>'
      return
    }

    tbody.innerHTML = '<tr><td colspan="5" class="loading">Loading transactions...</td></tr>'

    try {
      let txsHtml = ""

      for (const tx of transactions) {
        const value = Number.parseInt(tx.value, 16) / Math.pow(10, 18)
        const gasUsed = await this.getTransactionGasUsed(tx.hash)

        txsHtml += `
                    <tr>
                        <td>
                            <a href="/tx/${tx.hash}" class="clickable hash" onclick="explorer.navigateTo('/tx/${tx.hash}'); return false;">
                                ${this.truncateHash(tx.hash)}
                            </a>
                        </td>
                        <td>
                            <a href="/address/${tx.from}" class="address" onclick="explorer.navigateTo('/address/${tx.from}'); return false;">
                                ${this.truncateHash(tx.from)}
                            </a>
                        </td>
                        <td>
                            ${tx.to ? `<a href="/address/${tx.to}" class="address" onclick="explorer.navigateTo('/address/${tx.to}'); return false;">${this.truncateHash(tx.to)}</a>` : "Contract Creation"}
                        </td>
                        <td>${value.toFixed(6)} ETH</td>
                        <td>${gasUsed.toLocaleString()}</td>
                    </tr>
                `
      }

      tbody.innerHTML = txsHtml
    } catch (error) {
      tbody.innerHTML = '<tr><td colspan="5" class="no-data">Error loading transactions</td></tr>'
    }
  }

  async getTransactionGasUsed(txHash) {
    try {
      const receipt = await this.rpcCall("eth_getTransactionReceipt", [txHash])
      return receipt ? Number.parseInt(receipt.gasUsed, 16) : 0
    } catch (error) {
      return 0
    }
  }

  async performSearch() {
    const query = document.getElementById("searchInput").value.trim()
    if (!query) return

    // Detect search type and navigate
    if (query.startsWith("0x") && query.length === 66) {
      // Transaction hash
      this.navigateTo(`/tx/${query}`)
    } else if (query.startsWith("0x") && query.length === 42) {
      // Address
      this.navigateTo(`/address/${query}`)
    } else if (!isNaN(query)) {
      // Block number
      this.navigateTo(`/block/${query}`)
    } else {
      alert("Invalid search query. Please enter a valid address, transaction hash, or block number.")
    }
  }

  // Tab functions
  showAddressTab(tabName) {
    // Hide all tabs
    document.querySelectorAll(".tab").forEach((tab) => tab.classList.remove("active"))
    document.querySelectorAll(".tab-pane").forEach((pane) => pane.classList.remove("active"))

    // Show selected tab
    document.querySelector(`[onclick="showAddressTab('${tabName}')"]`).classList.add("active")
    document.getElementById(`${tabName}-tab`).classList.add("active")
  }

  showTxTab(tabName) {
    // Hide all tabs
    document.querySelectorAll(".tab").forEach((tab) => tab.classList.remove("active"))
    document.querySelectorAll(".tab-pane").forEach((pane) => pane.classList.remove("active"))

    // Show selected tab
    document.querySelector(`[onclick="showTxTab('${tabName}')"]`).classList.add("active")
    document.getElementById(`${tabName}-tab`).classList.add("active")
  }

  // Block navigation
  navigateBlock(direction) {
    const newBlockNumber = this.currentBlockNumber + direction
    if (newBlockNumber >= 0 && newBlockNumber <= this.latestBlockNumber) {
      this.navigateTo(`/block/${newBlockNumber}`)
    }
  }

  // Contract verification
  showVerifyContract() {
    document.getElementById("verifyModal").style.display = "block"
  }

  closeVerifyModal() {
    document.getElementById("verifyModal").style.display = "none"
  }

  async verifyContract() {
    const contractName = document.getElementById("verifyContractName").value
    const compiler = document.getElementById("verifyCompiler").value
    const optimization = document.getElementById("verifyOptimization").value
    const sourceCode = document.getElementById("verifySourceCode").value
    const constructorArgs = document.getElementById("verifyConstructorArgs").value

    // Simulate contract verification (in real implementation, this would call a backend service)
    alert(
      "Contract verification submitted! This is a demo - in production, this would compile and verify the contract.",
    )

    // Update contract info
    document.getElementById("contractName").textContent = contractName
    document.getElementById("contractCompiler").textContent = compiler
    document.getElementById("contractOptimization").textContent = optimization === "true" ? "Yes" : "No"
    document.getElementById("contractCode").textContent = sourceCode

    this.closeVerifyModal()
  }

  // Utility functions
  truncateHash(hash) {
    return `${hash.substring(0, 10)}...${hash.substring(hash.length - 8)}`
  }

  getTimeAgo(timestamp) {
    const now = Math.floor(Date.now() / 1000)
    const diff = now - timestamp

    if (diff < 60) return `${diff}s ago`
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    return `${Math.floor(diff / 86400)}d ago`
  }

  hexToString(hex) {
    if (!hex || hex === "0x") return ""
    try {
      let str = ""
      for (let i = 2; i < hex.length; i += 2) {
        const char = String.fromCharCode(Number.parseInt(hex.substr(i, 2), 16))
        if (char.charCodeAt(0) !== 0) str += char
      }
      return str.trim()
    } catch (e) {
      return hex
    }
  }

  copyToClipboard(elementId) {
    const element = document.getElementById(elementId)
    const text = element.textContent

    navigator.clipboard.writeText(text).then(() => {
      // Show temporary success message
      const button = element.nextElementSibling
      const originalText = button.innerHTML
      button.innerHTML = '<i class="fas fa-check"></i>'
      setTimeout(() => {
        button.innerHTML = originalText
      }, 2000)
    })
  }

  startAutoRefresh() {
    setInterval(() => {
      if (document.getElementById("home-page").classList.contains("active")) {
        this.loadNetworkStats()
        this.loadLatestBlocks()
        this.loadLatestTransactions()
      }
    }, 30000) // Refresh every 30 seconds
  }
}

// Global functions for onclick handlers
function showAddressTab(tabName) {
  explorer.showAddressTab(tabName)
}

function showTxTab(tabName) {
  explorer.showTxTab(tabName)
}

function navigateBlock(direction) {
  explorer.navigateBlock(direction)
}

function showVerifyContract() {
  explorer.showVerifyContract()
}

function closeVerifyModal() {
  explorer.closeVerifyModal()
}

function performSearch() {
  explorer.performSearch()
}

// Initialize explorer
const explorer = new PivexExplorer()

// Close modal when clicking outside
window.onclick = (event) => {
  const modal = document.getElementById("verifyModal")
  if (event.target === modal) {
    closeVerifyModal()
  }
}

// Dropdown menu functions
function toggleMenu() {
  const dropdown = document.getElementById("dropdownMenu")
  dropdown.classList.toggle("active")
}

// Close dropdown when clicking outside
document.addEventListener("click", (event) => {
  const dropdown = document.getElementById("dropdownMenu")
  const menuBtn = document.querySelector(".menu-btn")

  if (!dropdown.contains(event.target) && !menuBtn.contains(event.target)) {
    dropdown.classList.remove("active")
  }
})

// Functions for navigation menu items
function showBlocksList() {
  // Show a simple blocks list page
  document.querySelectorAll(".page").forEach((page) => page.classList.remove("active"))

  // Create or show blocks list
  let blocksListPage = document.getElementById("blocks-list-page")
  if (!blocksListPage) {
    blocksListPage = document.createElement("div")
    blocksListPage.id = "blocks-list-page"
    blocksListPage.className = "page"
    blocksListPage.innerHTML = `
      <div class="page-header">
        <h1><i class="fas fa-cubes"></i> All Blocks</h1>
      </div>
      <div class="content-card">
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Block</th>
                <th>Age</th>
                <th>Txns</th>
                <th>Gas Used</th>
                <th>Miner</th>
              </tr>
            </thead>
            <tbody id="allBlocksTable">
              <tr><td colspan="5" class="loading">Loading blocks...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `
    document.getElementById("content").appendChild(blocksListPage)
  }

  blocksListPage.classList.add("active")
  loadAllBlocks()
}

function showTransactionsList() {
  // Show a simple transactions list page
  document.querySelectorAll(".page").forEach((page) => page.classList.remove("active"))

  let txsListPage = document.getElementById("txs-list-page")
  if (!txsListPage) {
    txsListPage = document.createElement("div")
    txsListPage.id = "txs-list-page"
    txsListPage.className = "page"
    txsListPage.innerHTML = `
      <div class="page-header">
        <h1><i class="fas fa-exchange-alt"></i> All Transactions</h1>
      </div>
      <div class="content-card">
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Txn Hash</th>
                <th>Block</th>
                <th>From</th>
                <th>To</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody id="allTxsTable">
              <tr><td colspan="5" class="loading">Loading transactions...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `
    document.getElementById("content").appendChild(txsListPage)
  }

  txsListPage.classList.add("active")
  loadAllTransactions()
}

function showContractsList() {
  // Show contracts list page
  document.querySelectorAll(".page").forEach((page) => page.classList.remove("active"))

  let contractsListPage = document.getElementById("contracts-list-page")
  if (!contractsListPage) {
    contractsListPage = document.createElement("div")
    contractsListPage.id = "contracts-list-page"
    contractsListPage.className = "page"
    contractsListPage.innerHTML = `
      <div class="page-header">
        <h1><i class="fas fa-file-contract"></i> Smart Contracts</h1>
      </div>
      <div class="content-card">
        <div class="card-header">
          <h2>Verified Contracts</h2>
        </div>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Address</th>
                <th>Contract Name</th>
                <th>Compiler</th>
                <th>Balance</th>
              </tr>
            </thead>
            <tbody>
              <tr><td colspan="4" class="no-data">No verified contracts found</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `
    document.getElementById("content").appendChild(contractsListPage)
  }

  contractsListPage.classList.add("active")
}

function showTokensList() {
  // Show tokens list page
  document.querySelectorAll(".page").forEach((page) => page.classList.remove("active"))

  let tokensListPage = document.getElementById("tokens-list-page")
  if (!tokensListPage) {
    tokensListPage = document.createElement("div")
    tokensListPage.id = "tokens-list-page"
    tokensListPage.className = "page"
    tokensListPage.innerHTML = `
      <div class="page-header">
        <h1><i class="fas fa-coins"></i> Tokens</h1>
      </div>
      <div class="content-card">
        <div class="card-header">
          <h2>ERC-20 Tokens</h2>
        </div>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Token</th>
                <th>Symbol</th>
                <th>Address</th>
                <th>Holders</th>
              </tr>
            </thead>
            <tbody>
              <tr><td colspan="4" class="no-data">No tokens found</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `
    document.getElementById("content").appendChild(tokensListPage)
  }

  tokensListPage.classList.add("active")
}

async function loadAllBlocks() {
  const tbody = document.getElementById("allBlocksTable")
  if (!tbody) return

  tbody.innerHTML = '<tr><td colspan="5" class="loading">Loading blocks...</td></tr>'

  try {
    let blocksHtml = ""
    for (let i = 0; i < 25; i++) {
      const blockNumber = explorer.latestBlockNumber - i
      if (blockNumber < 0) break

      const block = await explorer.rpcCall("eth_getBlockByNumber", [`0x${blockNumber.toString(16)}`, true])

      if (block) {
        const timestamp = Number.parseInt(block.timestamp, 16)
        const age = explorer.getTimeAgo(timestamp)
        const txCount = block.transactions ? block.transactions.length : 0
        const gasUsed = Number.parseInt(block.gasUsed, 16)
        const gasLimit = Number.parseInt(block.gasLimit, 16)
        const gasPercent = ((gasUsed / gasLimit) * 100).toFixed(1)

        blocksHtml += `
          <tr>
            <td>
              <a href="#" class="clickable" onclick="explorer.navigateTo('/block/${blockNumber}'); return false;">
                ${blockNumber}
              </a>
            </td>
            <td>${age}</td>
            <td>${txCount}</td>
            <td>${gasUsed.toLocaleString()} (${gasPercent}%)</td>
            <td>
              <a href="#" class="address" onclick="explorer.navigateTo('/address/${block.miner}'); return false;">
                ${explorer.truncateHash(block.miner)}
              </a>
            </td>
          </tr>
        `
      }
    }
    tbody.innerHTML = blocksHtml || '<tr><td colspan="5" class="no-data">No blocks found</td></tr>'
  } catch (error) {
    tbody.innerHTML = '<tr><td colspan="5" class="no-data">Error loading blocks</td></tr>'
  }
}

async function loadAllTransactions() {
  const tbody = document.getElementById("allTxsTable")
  if (!tbody) return

  tbody.innerHTML = '<tr><td colspan="5" class="loading">Loading transactions...</td></tr>'

  try {
    let txsHtml = ""
    let txCount = 0

    for (let i = 0; i < 10 && txCount < 25; i++) {
      const blockNumber = explorer.latestBlockNumber - i
      if (blockNumber < 0) break

      const block = await explorer.rpcCall("eth_getBlockByNumber", [`0x${blockNumber.toString(16)}`, true])

      if (block && block.transactions) {
        for (const tx of block.transactions) {
          if (txCount >= 25) break

          const value = Number.parseInt(tx.value, 16) / Math.pow(10, 18)

          txsHtml += `
            <tr>
              <td>
                <a href="#" class="clickable hash" onclick="explorer.navigateTo('/tx/${tx.hash}'); return false;">
                  ${explorer.truncateHash(tx.hash)}
                </a>
              </td>
              <td>
                <a href="#" class="clickable" onclick="explorer.navigateTo('/block/${blockNumber}'); return false;">
                  ${blockNumber}
                </a>
              </td>
              <td>
                <a href="#" class="address" onclick="explorer.navigateTo('/address/${tx.from}'); return false;">
                  ${explorer.truncateHash(tx.from)}
                </a>
              </td>
              <td>
                ${tx.to ? `<a href="#" class="address" onclick="explorer.navigateTo('/address/${tx.to}'); return false;">${explorer.truncateHash(tx.to)}</a>` : "Contract Creation"}
              </td>
              <td>${value.toFixed(4)} ETH</td>
            </tr>
          `
          txCount++
        }
      }
    }
    tbody.innerHTML = txsHtml || '<tr><td colspan="5" class="no-data">No transactions found</td></tr>'
  } catch (error) {
    tbody.innerHTML = '<tr><td colspan="5" class="no-data">Error loading transactions</td></tr>'
  }
}
