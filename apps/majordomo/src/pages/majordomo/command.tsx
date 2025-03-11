import { useWindowSize } from "@src/hooks/use-window-size";
import { USE_VOICE_MODE } from "@src/lib/env";
import { proactiveDomains } from "@src/lib/proactive-domains";
import {
  CalendarIcon,
  CogIcon,
  CookingPotIcon,
  FootprintsIcon,
  MailIcon,
  MicIcon,
  ShapesIcon,
  SquareChevronRightIcon,
  TrophyIcon,
} from "lucide-react";
import { ComponentType, useEffect, useRef, useState } from "react";

import { useMajordomo } from "./provider";

const initialPrompt = import.meta.env.VITE_INITIAL_COMMAND_PROMPT ?? "";

export function CommandBar() {
  const { setUserIntent } = useMajordomo();
  const [isVisible, setIsVisible] = useState(false);
  const [inputValue, setInputValue] = useState(initialPrompt);
  const inputRef = useRef<HTMLInputElement>(null);
  const [numCustomSuggestions, setNumCustomSuggestions] = useState(0);

  const { windowSize } = useWindowSize();
  const WINDOW_SIZES = {
    width: {
      small: "80vw",
      medium: "44vw",
      wide: "38vw",
    },
    left: {
      small: "40vw",
      medium: "22vw",
      wide: "19vw",
    },
  };
  const commandSizes = {
    width:
      windowSize.width !== undefined
        ? windowSize.width < 1800
          ? windowSize.width < 1200
            ? WINDOW_SIZES.width.small
            : WINDOW_SIZES.width.medium
          : WINDOW_SIZES.width.wide
        : WINDOW_SIZES.width.wide,
    left:
      windowSize.width !== undefined
        ? windowSize.width < 1800
          ? windowSize.width < 1200
            ? WINDOW_SIZES.left.small
            : WINDOW_SIZES.left.medium
          : WINDOW_SIZES.left.wide
        : WINDOW_SIZES.left.wide,
  };

  async function onClick(e: React.MouseEvent) {
    e.preventDefault();

    await setUserIntent(inputValue);
    setIsVisible(false);
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey && e.shiftKey && e.key === "k") {
        e.preventDefault();
        setIsVisible((prev) => !prev);
      }
      if (isVisible && !isNaN(Number(e.key))) {
        // @TODO: number handler
        // const numberPressed = Number(e.key);
        // const suggestion = suggestions.find(
        //   (_, index) => index + 1 === numberPressed,
        // );
        // if (suggestion) {
        //   setInputValue(suggestion.description);
        //   setUserIntent(suggestion.description);
        //   setIsVisible(false);
        // }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (isVisible) {
      inputRef.current?.focus();
    }
  }, [isVisible]);

  if (!isVisible) {
    return <></>;
  }
  return (
    <form
      id="majordomo"
      className="pointer-events-auto fixed z-[2147483648] rounded-2xl bg-white"
      style={{
        left: `calc(50vw - ${commandSizes.left})`,
        top: "calc(30vh - 5vh)",
        width: commandSizes.width,
        border: "1px solid #D6DFFF",
        display: isVisible ? "block" : "hidden",
        boxShadow: "0 0 10px 0px rgb(91, 126, 255)",
        overflow: "hidden",
      }}
    >
      <div className="p-4">
        <div
          className="flex w-full items-center"
          style={{ margin: "0 0 1.5em 0" }}
        >
          <div
            className="relative flex w-full items-center rounded-xl p-1"
            style={{
              backgroundColor: "#EEF2FF",
            }}
          >
            <input
              ref={inputRef}
              placeholder="Talk to Plato..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className="w-full rounded-xl bg-transparent text-xl [&::selection]:bg-blue-200 [&::selection]:text-blue-800"
              style={{
                fontSize: "1em",
                color: "#777980",
                border: "none",
                outline: "none",
                caretColor: "#5B7EFF",
                padding: "0.5em",
              }}
            />
            {USE_VOICE_MODE && (
              <div
                className="absolute right-0 flex cursor-pointer rounded-full bg-white p-1"
                style={{ marginRight: "10px" }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.backgroundColor = "#ebedf0")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.backgroundColor = "white")
                }
              >
                <MicIcon color="black" />
              </div>
            )}
          </div>
          <button onClick={onClick} className="hidden" />
        </div>

        <CustomSuggestions
          setters={{
            setInputValue,
            setUserIntent,
            setIsVisible,
            setNumCustomSuggestions,
          }}
        />

        {/* <h3
          className="text-xs font-medium"
          style={{
            color: "#BFBFBF",
            fontWeight: 550,
            padding: "0 0.6em",
            margin: "1.5em 0 0.4em 0",
          }}
        >
          GENERAL
        </h3>
        <div className="flex flex-col" style={{ color: "#404040" }}>
          <Suggestion
            Icon={CalendarIcon}
            description="When's my next meeting?"
            number={numCustomSuggestions + 1}
            setters={{ setInputValue, setUserIntent, setIsVisible }}
          />
          <Suggestion
            Icon={MailIcon}
            description="Draft an email reply to Scott"
            number={numCustomSuggestions + 2}
            setters={{ setInputValue, setUserIntent, setIsVisible }}
          />
          <Suggestion
            Icon={MailIcon}
            description="Draft an email reply to Calix"
            number={numCustomSuggestions + 3}
            setters={{ setInputValue, setUserIntent, setIsVisible }}
          />
          <Suggestion
            Icon={TrophyIcon}
            description="Get me tickets to the Lakers game"
            number={numCustomSuggestions + 4}
            setters={{ setInputValue, setUserIntent, setIsVisible }}
          />
        </div> */}
      </div>

      <div
        className="flex items-center gap-x-8"
        style={{
          backgroundColor: "#F7F9FF",
          padding: "0 1em",
          justifyContent: "end",
          color: "#B9BBBF",
        }}
      >
        <div className="flex cursor-pointer items-center gap-x-1">
          <SquareChevronRightIcon size={18} />
          <p className="text-sm">Action</p>
        </div>
        <div
          style={{
            backgroundColor: "#DEE0E5",
            width: "2px",
            height: "1.5em",
          }}
        />
        <div className="flex cursor-pointer items-center gap-x-1">
          <CogIcon size={18} />
          <p className="text-sm">Settings</p>
        </div>
      </div>
    </form>
  );
}

function CustomSuggestions({
  setters,
}: {
  setters: {
    setInputValue: React.Dispatch<React.SetStateAction<string>>;
    setUserIntent: (intent: string) => void;
    setIsVisible: React.Dispatch<React.SetStateAction<boolean>>;
    setNumCustomSuggestions: React.Dispatch<React.SetStateAction<number>>;
  };
}) {
  const {
    setInputValue,
    setUserIntent,
    setIsVisible,
    setNumCustomSuggestions,
  } = setters;

  const proactiveDomain = proactiveDomains.find((domain) =>
    window.location.hostname.includes(domain),
  );
  const siteName = proactiveDomain?.split(".").at(-2)?.toUpperCase();
  if (!siteName) {
    return <></>;
  }

  const suggestions = getSuggestions(siteName);
  if (suggestions.length === 0) {
    return <></>;
  }

  useEffect(() => {
    setNumCustomSuggestions(suggestions.length);
  }, []);
  return (
    <div className="">
      <h3
        className="text-xs font-medium"
        style={{
          color: "#BFBFBF",
          fontWeight: 550,
          padding: "0 0.6em",
          margin: "0.4em 0",
        }}
      >
        {siteName} SUGGESTIONS
      </h3>
      <div className="flex flex-col" style={{ color: "#404040" }}>
        {suggestions.map((s, index) => (
          <Suggestion
            key={index}
            Icon={s.Icon}
            description={s.description}
            number={index + 1}
            setters={{ setInputValue, setUserIntent, setIsVisible }}
          />
        ))}
      </div>
    </div>
  );
}

function getSuggestions(siteName: string) {
  return [
    { Icon: CookingPotIcon, description: "Get me a Lacrusette set" },
    {
      Icon: ShapesIcon,
      description: "Grab the nicest jellycat and add it to cart",
    },
    { Icon: FootprintsIcon, description: "On running Cloudmonster" },
  ];
}

function Suggestion({
  Icon,
  description,
  number,
  setters,
}: {
  Icon: ComponentType;
  description: string;
  number: number;
  setters: {
    setInputValue: React.Dispatch<React.SetStateAction<string>>;
    setUserIntent: (intent: string) => void;
    setIsVisible: React.Dispatch<React.SetStateAction<boolean>>;
  };
}) {
  const { setInputValue, setUserIntent, setIsVisible } = setters;

  return (
    <div
      className="flex cursor-pointer items-center justify-start rounded-lg"
      style={{ padding: "0.25em 0.6em" }}
      // hover CSS not working
      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#F7F9FF")}
      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#FFF")}
    >
      <Icon />
      <p
        className="rounded-md p-2"
        style={{ margin: 0 }}
        onClick={(e) => {
          const input = e.currentTarget.textContent?.trim() ?? "";
          setInputValue(input);
          setUserIntent(input);
          setIsVisible(false);
        }}
      >
        {description}
      </p>
      <div
        className="flex items-center justify-center rounded-md"
        style={{
          backgroundColor: "#F7F9FF",
          margin: "auto 0 auto auto",
          border: "1.5px solid #EBF0FF",
          borderBottom: "4px solid #EBF0FF",
        }}
      >
        <p
          className="text-sm"
          style={{ margin: 0, padding: "2px 8px", color: "#B9BBBF" }}
        >
          {number}
        </p>
      </div>
    </div>
  );
}
