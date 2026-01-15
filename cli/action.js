
(async () => {
    // --- Configuration ---
    const RPC_URL = "https://rpc.mantle.xyz";

    // 1. Get params from accessControlConditions
    // We expect the parameters in this order: [repoId, contractAddress, userAddress]
    // Note: The condition must have standardContractType === "LitAction"
    const _cond = accessControlConditions.find(c => c.standardContractType === "LitAction");
    const params = _cond.parameters;
    const repoId = params[0];
    const contractAddress = params[1];
    const userAddress = params[2];

    if (!repoId || !contractAddress || !userAddress) {
        console.log("Missing required params");
        LitActions.setResponse({ response: "false" });
        return;
    }

    const abi = [
        "function hasAccess(uint256 repoId, address user) view returns (bool)"
    ];

    const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(contractAddress, abi, provider);

    try {
        console.log("Checking access for Repo " + repoId + " User " + userAddress);
        const hasAccess = await contract.hasAccess(repoId, userAddress);
        console.log("Result: " + hasAccess);
        // Returns "true" or "false" string
        LitActions.setResponse({ response: hasAccess.toString() });
    } catch (error) {
        console.error("Error checking access:", error);
        LitActions.setResponse({ response: "false" });
    }
})();
