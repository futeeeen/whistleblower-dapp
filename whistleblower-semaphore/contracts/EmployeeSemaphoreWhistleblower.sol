// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "@semaphore-protocol/contracts/interfaces/ISemaphore.sol";

contract EmployeeSemaphoreWhistleblower {
    struct Report {
        uint256 id;
        string ipfsCID;
        string messageHash;
        uint256 timestamp;
        uint256 nullifier;
        uint256 message;
    }

    address public owner;
    ISemaphore public semaphore;
    uint256 public groupId;
    uint256 public reportCount;

    string public adminEncryptionPublicKey;

    mapping(uint256 => Report) public reports;
    mapping(uint256 => bool) public memberCommitmentExists;

    event EmployeeMemberAdded(uint256 indexed identityCommitment);
    event AdminEncryptionPublicKeyUpdated(string publicKey);
    event AnonymousReportSubmitted(
        uint256 indexed reportId,
        uint256 indexed nullifier,
        uint256 indexed message,
        string ipfsCID,
        string messageHash,
        uint256 timestamp
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    constructor(address semaphoreAddress) {
        owner = msg.sender;
        semaphore = ISemaphore(semaphoreAddress);
        groupId = semaphore.createGroup(address(this));
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Zero address");
        owner = newOwner;
    }

    function setAdminEncryptionPublicKey(string calldata publicKey) external onlyOwner {
        require(bytes(publicKey).length > 0, "Empty key");
        adminEncryptionPublicKey = publicKey;
        emit AdminEncryptionPublicKeyUpdated(publicKey);
    }

    function addEmployeeMember(uint256 identityCommitment) external onlyOwner {
        require(!memberCommitmentExists[identityCommitment], "Member already added");
        semaphore.addMember(groupId, identityCommitment);
        memberCommitmentExists[identityCommitment] = true;
        emit EmployeeMemberAdded(identityCommitment);
    }

    function submitAnonymousReport(
        string calldata ipfsCID,
        string calldata messageHash,
        ISemaphore.SemaphoreProof calldata proof
    ) external {
        require(bytes(ipfsCID).length > 0, "Empty ipfsCID");
        require(bytes(messageHash).length > 0, "Empty messageHash");

        uint256 expectedMessage = uint256(keccak256(abi.encodePacked(ipfsCID, messageHash)));
        require(proof.message == expectedMessage, "Proof message mismatch");

        semaphore.validateProof(groupId, proof);

        reportCount += 1;
        reports[reportCount] = Report({
            id: reportCount,
            ipfsCID: ipfsCID,
            messageHash: messageHash,
            timestamp: block.timestamp,
            nullifier: proof.nullifier,
            message: proof.message
        });

        emit AnonymousReportSubmitted(
            reportCount,
            proof.nullifier,
            proof.message,
            ipfsCID,
            messageHash,
            block.timestamp
        );
    }
}
