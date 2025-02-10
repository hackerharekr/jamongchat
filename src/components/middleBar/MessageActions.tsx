"use client";

import { copyText, deleteFile, getTimeReportFromDate } from "@/utils";
import { GoReply } from "react-icons/go";
import {
  MdContentCopy,
  MdOutlineModeEdit,
  MdOutlinePlayCircle,
} from "react-icons/md";
import { IoArrowBackOutline } from "react-icons/io5";
import { AiOutlineDelete } from "react-icons/ai";
import { LuPin } from "react-icons/lu";
import { RefObject, useCallback, useEffect, useMemo, useState } from "react";
import useSockets from "@/store/useSockets";
import useUserStore from "@/store/userStore";
import User from "@/models/user";
import Modal from "../modules/Modal";
import DropDown from "../modules/ui/DropDown";
import useModalStore from "@/store/modalStore";
import useGlobalStore from "@/store/globalStore";
import Image from "next/image";
import Message from "@/models/message";

interface MessageActionsProps {
  isFromMe: boolean;
  messageRef: RefObject<HTMLDivElement | null>;
}

type PlayedByUsersData = User & { seenTime: string };

const MessageActions = ({ isFromMe, messageRef }: MessageActionsProps) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [playedByUsersData, setPlayedByUsersData] = useState<
    PlayedByUsersData[]
  >([]);
  const [dropDownPosition, setDropDownPosition] = useState({ top: 0 });

  const {
    setter: modalSetter,
    msgData,
    isChecked,
  } = useModalStore((state) => state);
  const { setter } = useGlobalStore((state) => state);
  const roomSocket = useSockets((state) => state.rooms);
  const myID = useUserStore((state) => state._id);

  const roomData = useMemo(() => {
    const rooms = useUserStore.getState()?.rooms;
    return rooms.find((room) => room._id === msgData?.roomID);
  }, [msgData?.roomID]);

  const onClose = useCallback(() => {
    modalSetter((prev) => ({ ...prev, msgData: null }));
  }, [modalSetter]);

  const copy = useCallback(() => {
    if (msgData) copyText(msgData.message);
    onClose();
  }, [msgData, onClose]);

  const deleteMessage = useCallback(() => {
    onClose();
    modalSetter((prev) => ({
      ...prev,
      isOpen: true,
      title: "Delete message",
      bodyText: "Are you sure you want to delete this message?",
      isCheckedText: "Also delete for others",
      onSubmit: async () => {
        const currentIsChecked = useModalStore.getState().isChecked;

        if (msgData?.voiceData?.src && currentIsChecked) {
          await deleteFile(msgData.voiceData.src);
        }

        roomSocket?.emit("deleteMsg", {
          forAll: currentIsChecked,
          msgID: msgData?._id,
          roomID: msgData?.roomID,
        });
      },
    }));
    //TODO پاکش کن
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [msgData, isChecked, roomSocket]);

  const openProfile = useCallback(
    (profileData: User) => {
      setter({
        mockSelectedRoomData: profileData,
        shouldCloseAll: true,
        isRoomDetailsShown: true,
      });
      modalSetter((prev) => ({ ...prev, msgData: null }));
    },
    [modalSetter, setter]
  );

  const actionHandler = useCallback(
    (action?: ((data: Message) => void) | ((_id: string) => void)) => () => {
      if (msgData && action) {
        if ((action as (_id: string) => void).length === 1) {
          (action as (_id: string) => void)(msgData._id);
        } else {
          (action as (data: Message) => void)(msgData);
        }
        onClose();
      }
    },
    [msgData, onClose]
  );

  useEffect(() => {
    if (!roomSocket || !msgData?._id || !msgData?.voiceData?.playedBy?.length)
      return;

    roomSocket.emit("getVoiceMessageListeners", msgData._id);
    roomSocket.on("getVoiceMessageListeners", setPlayedByUsersData);

    return () => {
      if (roomSocket) {
        roomSocket.off("getVoiceMessageListeners");
      }
    };
  }, [roomSocket, msgData]);

  useEffect(() => {
    const chatContainer = document.getElementById("chatContainer");
    const messageRefRect = messageRef.current?.getBoundingClientRect();
    const chatContainerRect = chatContainer?.getBoundingClientRect();

    if (messageRefRect && chatContainerRect) {
      const newPosition =
        messageRefRect.bottom + 100 > chatContainerRect.bottom
          ? {
              top:
                msgData?.voiceData?.playedBy?.length &&
                msgData?.voiceData?.playedBy?.length > 0
                  ? -140
                  : -130,
            }
          : messageRefRect.top < 100 &&
            messageRefRect.top + 75 > chatContainerRect.top
          ? {
              top:
                msgData?.voiceData?.playedBy?.length &&
                msgData?.voiceData?.playedBy?.length > 0
                  ? 85
                  : 65,
            }
          : { top: 0 };

      setDropDownPosition(newPosition);
    }
  }, [messageRef, msgData?.voiceData?.playedBy?.length]);

  const dropDownItems = useMemo(
    () =>
      [
        msgData?.voiceData?.playedBy?.length && {
          title: isCollapsed ? (
            "Back"
          ) : (
            <div className="flex relative justify-between items-center w-full ">
              <span>Played by</span>
              {playedByUsersData?.length > 0 && (
                <span>
                  {playedByUsersData.slice(0, 2).map((user, index) =>
                    user.avatar ? (
                      <Image
                        key={user._id}
                        width={24}
                        height={24}
                        loading="lazy"
                        style={{
                          position: "absolute",
                          right: index === 1 ? "10px" : "0",
                          top: 0,
                          zIndex: index,
                        }}
                        className="object-cover size-6 rounded-full"
                        src={user?.avatar}
                        alt="user avatar"
                      />
                    ) : (
                      <div
                        className="flex-center text-md bg-blue-400 rounded-full p-1 pt-2 size-6"
                        key={user._id}
                      >
                        {user.name[0]}
                      </div>
                    )
                  )}
                </span>
              )}
            </div>
          ),
          icon: isCollapsed ? (
            <IoArrowBackOutline className="size-5  text-gray-400 mb-1" />
          ) : (
            <MdOutlinePlayCircle className="size-5  text-gray-400 mb-1" />
          ),
          onClick: () => setIsCollapsed((prev) => !prev),
          itemClassNames: "border-b-3 border-chatBg",
        },
        ...(!isCollapsed
          ? [
              roomData?.type !== "channel" && {
                title: "Reply",
                icon: <GoReply className="size-5  text-gray-400 " />,
                onClick: actionHandler(msgData?.addReplay),
              },
              (roomData?.type !== "channel" ||
                roomData?.admins?.includes(myID)) && {
                title: msgData?.pinnedAt ? "Unpin" : "Pin",
                icon: <LuPin className="size-5  text-gray-400 " />,
                onClick: actionHandler(msgData?.pin),
              },
              {
                title: "Copy",
                icon: <MdContentCopy className="size-5  text-gray-400 " />,
                onClick: copy,
              },
              msgData?.sender._id === myID && {
                title: "Edit",
                icon: <MdOutlineModeEdit className="size-5  text-gray-400 " />,
                onClick: actionHandler(msgData?.edit),
              },
              (roomData?.type === "private" ||
                msgData?.sender._id === myID ||
                roomData?.admins?.includes(myID)) && {
                title: "Delete",
                icon: <AiOutlineDelete className="size-5  text-gray-400 " />,
                onClick: deleteMessage,
              },
            ]
          : playedByUsersData.map((user) => ({
              title: (
                <div className="flex w-full justify-between mt-1">
                  <span className="-ml-2">
                    {user?._id == myID ? "You" : user?.name}
                  </span>
                  <span>{getTimeReportFromDate(user.seenTime)}</span>
                </div>
              ),
              icon: user.avatar ? (
                <Image
                  key={user._id}
                  width={24}
                  height={24}
                  className="object-cover size-6 rounded-full"
                  src={user.avatar}
                  alt="user avatar"
                />
              ) : (
                <div className="flex-center text-md bg-blue-400 rounded-full p-1 pt-2 size-6">
                  {user.name[0]}
                </div>
              ),
              onClick: () => openProfile(user),
            }))),
      ]
        .map((item) => item || null)
        .filter((item) => item !== null),
    [
      isCollapsed,
      msgData,
      roomData,
      myID,
      playedByUsersData,
      copy,
      deleteMessage,
      actionHandler,
      openProfile,
    ]
  );

  return (
    <>
      <DropDown
        button={<></>}
        dropDownItems={dropDownItems}
        setIsOpen={onClose}
        isOpen={Boolean(msgData)}
        classNames={`h-fit transition-all duration-300 ${
          isCollapsed ? "w-52" : "w-40"
        } ${isFromMe ? "right-[65%]" : "left-[65%]"}`}
        style={{ top: `${-40 + dropDownPosition.top}px` }}
      />
      <Modal />
    </>
  );
};

export default MessageActions;

// import { copyText, getTimeReportFromDate } from "@/utils";
// import { GoReply } from "react-icons/go";
// import {
//   MdContentCopy,
//   MdOutlineModeEdit,
//   MdOutlinePlayCircle,
// } from "react-icons/md";
// import { IoArrowBackOutline } from "react-icons/io5";
// import { AiOutlineDelete } from "react-icons/ai";
// import { LuPin } from "react-icons/lu";
// import { RefObject, useCallback, useEffect, useMemo, useState } from "react";
// import useSockets from "@/store/useSockets";
// import useUserStore from "@/store/userStore";
// import User from "@/models/user";
// import Modal from "./Modal";
// import DropDown from "./ui/DropDown";
// import useModalStore from "@/store/modalStore";
// import useGlobalStore from "@/store/globalStore";
// import Image from "next/image";
// import Message from "@/models/message";

// interface MessageActionsProps {
//   isFromMe: boolean;
//   messageRef: RefObject<HTMLDivElement | null>;
// }
// type playedByUsersData = User & { seenTime: string };

// const MessageActions = ({ isFromMe, messageRef }: MessageActionsProps) => {
//   const [isCollapsed, setIsCollapsed] = useState(false);
//   const [playedByUsersData, setPlayedByUsersData] = useState<
//     playedByUsersData[]
//   >([]);
//   const [dropDownPosition, setDropDownPosition] = useState({ top: 0 });
//   const {
//     setter: modalSetter,
//     msgData,
//     isChecked,
//   } = useModalStore((state) => state);
//   const { setter } = useGlobalStore((state) => state);
//   const roomSocket = useSockets((state) => state.rooms);
//   const myID = useUserStore((state) => state._id);

//   const actionHandler =
//     (action: ((data: Message) => void) | ((_id: string) => void) | undefined) =>
//     () => {
//       if (msgData && action) {
//         if (action.length === 1) {
//           if (typeof msgData._id === "string") {
//             (action as (_id: string) => void)(msgData._id);
//           }
//         } else {
//           (action as (data: Message) => void)(msgData);
//         }
//         onClose();
//       }
//     };

//   const copy = () => {
//     copyText(msgData!.message);
//     onClose();
//   };

//   const roomData = useMemo(() => {
//     const rooms = useUserStore.getState()?.rooms;
//     return rooms.find((room) => room._id === msgData?.roomID);
//   }, [msgData?.roomID]);

//   const deleteMessage = () => {
//     onClose();
//     modalSetter((prev) => ({
//       ...prev,
//       isOpen: true,
//       title: "Delete message",
//       bodyText: "Are you sure you want to delete this message?",
//       isCheckedText: "Also delete for others",
//       onSubmit: () => {
//         roomSocket?.emit("deleteMsg", {
//           forAll: isChecked,
//           msgID: msgData?._id,
//           roomID: msgData?.roomID,
//         });
//       },
//     }));
//   };

//   const onClose = () => {
//     modalSetter((prev) => ({
//       ...prev,
//       msgData: null,
//     }));
//   };

//   const openProfile = (profileData: User) => {
//     setter({
//       mockSelectedRoomData: profileData,
//       shouldCloseAll: true,
//       isRoomDetailsShown: true,
//     });
//     modalSetter((prev) => ({ ...prev, msgData: null }));
//   };

//   const fetchVoiceMessageListeners = useCallback(() => {
//     if (!roomSocket || !msgData?._id || !msgData?.voiceData?.playedBy?.length)
//       return;

//     roomSocket.emit("getVoiceMessageListeners", msgData._id);
//     roomSocket.on("getVoiceMessageListeners", (data) =>
//       setPlayedByUsersData(data)
//     );

//     return () => {
//       roomSocket.off("getVoiceMessageListeners");
//     };
//   }, [roomSocket, msgData]);

//   useEffect(() => {
//     const cleanup = fetchVoiceMessageListeners();
//     return cleanup;
//   }, [fetchVoiceMessageListeners]);

//   const dropDownItems = [
//     msgData?.voiceData?.playedBy?.length && {
//       title: isCollapsed ? (
//         "Back"
//       ) : (
//         <div className="flex justify-between items-center w-full">
//           <span>Played by</span>
//           {playedByUsersData?.length > 0 && (
//             <span>
//               {playedByUsersData.slice(0, 1).map((user) =>
//                 user.avatar ? (
//                   <Image
//                     key={user._id}
//                     width={32}
//                     height={32}
//                     loading="lazy"
//                     className="object-cover size-full rounded-full"
//                     src={user?.avatar}
//                     alt="user avatar"
//                   />
//                 ) : (
//                   <div
//                     className="flex-center text-md bg-blue-400 rounded-full p-1 pt-2 size-6"
//                     key={user._id}
//                   >
//                     {user.name[0]}
//                   </div>
//                 )
//               )}
//             </span>
//           )}
//         </div>
//       ),
//       icon: isCollapsed ? (
//         <IoArrowBackOutline className="size-5  text-gray-400 " />
//       ) : (
//         <MdOutlinePlayCircle className="size-5  text-gray-400 mb-1" />
//       ),
//       onClick: () => setIsCollapsed((prev) => !prev),
//       itemClassNames: "border-b-3 border-chatBg",
//     },
//     ...(isCollapsed
//       ? playedByUsersData.map((user) => ({
//           title: (
//             <div className="flex w-full mt-1">
//               <span> {user?._id == myID ? "You" : user?.name}</span>
//               <span className="ml-auto">
//                 {"seenTime" in user ? getTimeReportFromDate(user.seenTime) : ""}
//               </span>
//             </div>
//           ),
//           onClick: () => openProfile(user),
//           icon: user.avatar ? (
//             <Image
//               key={user._id}
//               width={32}
//               height={32}
//               loading="lazy"
//               className="object-cover size-full rounded-full"
//               src={user?.avatar}
//               alt="user avatar"
//             />
//           ) : (
//             <div
//               className="flex-center text-md bg-blue-400 rounded-full p-1 pt-2 size-6"
//               key={user._id}
//             >
//               {user.name[0]}
//             </div>
//           ),
//         }))
//       : []),

//     !isCollapsed &&
//       roomData?.type &&
//       roomData?.type !== "channel" && {
//         title: "Reply",
//         icon: <GoReply className="size-5  text-gray-400 mb-1" />,
//         onClick: actionHandler(msgData?.addReplay),
//       },
//     ((roomData?.type && roomData?.type !== "channel") ||
//       roomData?.admins?.includes(myID)) &&
//       !isCollapsed && {
//         title: msgData?.pinnedAt ? "Unpin" : "Pin",
//         icon: <LuPin className="size-5  text-gray-400 mb-1" />,
//         onClick: actionHandler(msgData?.pin),
//       },
//     !isCollapsed && {
//       title: "Copy",
//       icon: <MdContentCopy className="size-5  text-gray-400 mb-1" />,
//       onClick: copy,
//     },
//     ((roomData?.type == "private" && msgData?.sender?._id == myID) ||
//       (roomData?.type !== "private" && msgData?.sender._id === myID)) &&
//       !isCollapsed && {
//         title: "Edit",
//         icon: <MdOutlineModeEdit className="size-5  text-gray-400 mb-1" />,
//         onClick: actionHandler(msgData?.edit),
//       },

//     (roomData?.type === "private" ||
//       msgData?.sender._id === myID ||
//       roomData?.admins?.includes(myID)) &&
//       !isCollapsed && {
//         title: "Delete",
//         icon: <AiOutlineDelete className="size-5  text-gray-400 mb-1" />,
//         onClick: deleteMessage,
//       },
//   ]
//     .map((item) => item || null)
//     .filter((item) => item !== null);

//   useEffect(() => {
//     const chatContainer = document.getElementById("chatContainer");
//     const messageRefRect = messageRef.current?.getBoundingClientRect();
//     const chatContainerRect = chatContainer?.getBoundingClientRect();

//     if (chatContainerRect?.bottom && messageRefRect) {
//       if (messageRefRect.bottom + 100 > chatContainerRect.bottom) {
//         setDropDownPosition({ top: -120 });
//       }
//       if (
//         messageRefRect.top < 100 &&
//         messageRefRect.top + 35 > chatContainerRect.top
//       ) {
//         setDropDownPosition({ top: 65 });
//       }
//     }
//   }, [messageRef]);

//   return (
//     <>
//       <DropDown
//         button={<></>}
//         dropDownItems={dropDownItems}
//         setIsOpen={onClose}
//         isOpen={Boolean(msgData)}
//         classNames={` h-fit transition-all duration-300 ${
//           isCollapsed ? "w-48" : "w-40"
//         } ${isFromMe ? "right-[65%]" : "left-[65%]"}`}
//         style={{ top: `${-40 + dropDownPosition.top}px` }}
//       />
//       <Modal />
//     </>
//   );
// };

// export default MessageActions;
