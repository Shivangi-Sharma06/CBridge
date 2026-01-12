// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// four functions - stake, addreward, unstake, deductslash
// exchange arte api needed / what if total share =0



contract MockSol{
    
    uint totalShares;
    uint shares;
    uint totalETH;

    function stake () external payable{
            uint amount = msg.value; //recieve 
            address user= msg.sender; //total eth

            if(totalShares==0){
                shares = totalETH;
            }
            else{
                shares = totalETH + amount;
            }




    }


}