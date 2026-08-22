/**
 * @tipkit/components —— shadcn/ui 风格基础组件
 *
 * 手写精简版（Radix + cva + tailwind-merge），颜色走 CSS 变量，
 * 主题通过加载不同 CSS（@tipkit/themes）切换。
 *
 * 组件清单：button / dropdown-menu / popover / dialog / tooltip
 * 后续可按需补充：input / select / command / separator / tabs 等。
 */
export { cn } from "./lib/utils";
export { Button, buttonVariants } from "./ui/button";
export type { ButtonProps } from "./ui/button";
export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuGroup,
  DropdownMenuSeparator,
} from "./ui/dropdown-menu";
export { Popover, PopoverTrigger, PopoverContent } from "./ui/popover";
export {
  Dialog,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "./ui/tooltip";
export { Input } from "./ui/input";
