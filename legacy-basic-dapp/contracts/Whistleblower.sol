// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Whistleblower {
    enum Status {
        Pending,
        UnderInvestigation,
        Resolved
    }

    struct Case {
        uint256 id;
        string ipfsCID;
        string contentHash;
        Status status;
        uint256 timestamp;
    }

    mapping(uint256 => Case) public cases;
    uint256 public caseCount;

    event ReportSubmitted(uint256 indexed caseId, string ipfsCID, uint256 timestamp);
    event StatusUpdated(uint256 indexed caseId, Status newStatus);

    function submitReport(string memory _ipfsCID, string memory _contentHash) public {
        caseCount++;
        cases[caseCount] = Case({
            id: caseCount,
            ipfsCID: _ipfsCID,
            contentHash: _contentHash,
            status: Status.Pending,
            timestamp: block.timestamp
        });

        emit ReportSubmitted(caseCount, _ipfsCID, block.timestamp);
    }

    function updateStatus(uint256 _caseId, Status _newStatus) public {
        require(_caseId > 0 && _caseId <= caseCount, "Invalid case id");
        cases[_caseId].status = _newStatus;
        emit StatusUpdated(_caseId, _newStatus);
    }
}